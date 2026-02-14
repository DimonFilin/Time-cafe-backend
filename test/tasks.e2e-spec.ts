import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { KeycloakService } from '../src/modules/auth/services/keycloak.service';
import {
  createSystemAdmin,
  createBrandAdmin,
  createCafeAdmin,
  createWorker,
  createBrand,
  createRegion,
  createCafe,
  getTestFactoriesDeps,
} from './helpers/test-factories';
import { TaskCategory, TaskPriority, TaskAssignmentType } from '@prisma/client';

describe('Tasks E2E Tests', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let keycloakService: KeycloakService;

  // Test data
  let systemAdminToken: string;
  let cafeAdminToken: string;
  let worker1Token: string;
  let worker2Token: string;
  let brandId: string;
  let regionId: string;
  let cafeId: string;
  let worker1Id: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    prisma = moduleFixture.get<PrismaService>(PrismaService);
    keycloakService = moduleFixture.get<KeycloakService>(KeycloakService);

    await app.init();

    const deps = getTestFactoriesDeps(app, prisma, keycloakService);

    // Create test data
    systemAdminToken = await createSystemAdmin(deps);

    const brand = await createBrand(deps, { name: 'Test Brand for Tasks' });
    brandId = brand.id;

    const region = await createRegion(deps, { name: 'Test Region for Tasks' });
    regionId = region.id;

    const cafe = await createCafe(deps, {
      brandId,
      regionId,
      name: 'Test Cafe for Tasks',
    });
    cafeId = cafe.id;

    cafeAdminToken = await createCafeAdmin(
      deps,
      systemAdminToken,
      cafeId,
      brandId,
    );
    worker1Token = await createWorker(deps, systemAdminToken, cafeId, brandId);
    worker2Token = await createWorker(deps, systemAdminToken, cafeId, brandId);

    // Get worker IDs
    const worker1Me = await request(app.getHttpServer())
      .get('/auth/me')
      .set('Authorization', `Bearer ${worker1Token}`)
      .expect(200);
    worker1Id = worker1Me.body.id;
  });

  afterAll(async () => {
    if (prisma) {
      // Cleanup test data
      await prisma.taskCompletion.deleteMany({
        where: {
          template: {
            cafeId,
          },
        },
      });

      await prisma.taskTemplate.deleteMany({
        where: {
          cafeId,
        },
      });

      await prisma.workerAccount.deleteMany({
        where: {
          cafeId,
        },
      });

      await prisma.cafe.deleteMany({
        where: {
          id: cafeId,
        },
      });

      await prisma.brand.deleteMany({
        where: {
          id: brandId,
        },
      });

      await prisma.region.deleteMany({
        where: {
          id: regionId,
        },
      });
    }

    if (app) {
      await app.close();
    }
  });

  describe('Cafe Admin - Task Templates', () => {
    let templateId: string;

    it('should create a task template (ALL_WORKERS)', async () => {
      const response = await request(app.getHttpServer())
        .post('/cafe-admin/tasks/templates')
        .set('Authorization', `Bearer ${cafeAdminToken}`)
        .send({
          title: 'Check Coffee Machine',
          description: 'Check temperature, pressure, and cleanliness',
          category: TaskCategory.OPENING,
          priority: TaskPriority.HIGH,
          requiresPhoto: false,
          requiresComment: false,
          estimatedMinutes: 10,
          assignmentType: TaskAssignmentType.ALL_WORKERS,
          daysOfWeek: [1, 2, 3, 4, 5], // Mon-Fri
        })
        .expect(201);

      expect(response.body).toHaveProperty('id');
      expect(response.body.title).toBe('Check Coffee Machine');
      expect(response.body.category).toBe(TaskCategory.OPENING);
      expect(response.body.priority).toBe(TaskPriority.HIGH);
      expect(response.body.assignmentType).toBe(TaskAssignmentType.ALL_WORKERS);
      expect(response.body.isActive).toBe(true);

      templateId = response.body.id;
    });

    it('should create a task template (SPECIFIC_WORKERS)', async () => {
      const response = await request(app.getHttpServer())
        .post('/cafe-admin/tasks/templates')
        .set('Authorization', `Bearer ${cafeAdminToken}`)
        .send({
          title: 'Clean Hall',
          description: 'Clean tables, sweep floor',
          category: TaskCategory.OPENING,
          priority: TaskPriority.MEDIUM,
          requiresPhoto: true,
          requiresComment: false,
          estimatedMinutes: 15,
          assignmentType: TaskAssignmentType.SPECIFIC_WORKERS,
          assignedWorkerIds: [worker1Id],
          daysOfWeek: [], // Every day
        })
        .expect(201);

      expect(response.body.assignmentType).toBe(
        TaskAssignmentType.SPECIFIC_WORKERS,
      );
      expect(response.body.assignedWorkerIds).toContain(worker1Id);
      expect(response.body.requiresPhoto).toBe(true);
    });

    it('should fail to create template without required fields', async () => {
      await request(app.getHttpServer())
        .post('/cafe-admin/tasks/templates')
        .set('Authorization', `Bearer ${cafeAdminToken}`)
        .send({
          title: 'Invalid Task',
          // Missing category, priority, assignmentType
        })
        .expect(500); // TODO: Should be 400 after adding proper DTO validation
    });

    it('should fail to create SPECIFIC_WORKERS template without assignedWorkerIds', async () => {
      await request(app.getHttpServer())
        .post('/cafe-admin/tasks/templates')
        .set('Authorization', `Bearer ${cafeAdminToken}`)
        .send({
          title: 'Invalid Task',
          category: TaskCategory.SHIFT,
          priority: TaskPriority.LOW,
          assignmentType: TaskAssignmentType.SPECIFIC_WORKERS,
          // Missing assignedWorkerIds
        })
        .expect(400);
    });

    it('should get all task templates', async () => {
      const response = await request(app.getHttpServer())
        .get('/cafe-admin/tasks/templates')
        .set('Authorization', `Bearer ${cafeAdminToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeGreaterThanOrEqual(2);
      expect(response.body[0]).toHaveProperty('id');
      expect(response.body[0]).toHaveProperty('title');
    });

    it('should update a task template', async () => {
      const response = await request(app.getHttpServer())
        .patch(`/cafe-admin/tasks/templates/${templateId}`)
        .set('Authorization', `Bearer ${cafeAdminToken}`)
        .send({
          title: 'Check Coffee Machine (Updated)',
          priority: TaskPriority.MEDIUM,
        })
        .expect(200);

      expect(response.body.title).toBe('Check Coffee Machine (Updated)');
      expect(response.body.priority).toBe(TaskPriority.MEDIUM);
    });

    it('should deactivate a task template', async () => {
      const response = await request(app.getHttpServer())
        .patch(`/cafe-admin/tasks/templates/${templateId}/deactivate`)
        .set('Authorization', `Bearer ${cafeAdminToken}`)
        .expect(200);

      expect(response.body.isActive).toBe(false);
    });

    it('should not show deactivated templates by default', async () => {
      const response = await request(app.getHttpServer())
        .get('/cafe-admin/tasks/templates')
        .set('Authorization', `Bearer ${cafeAdminToken}`)
        .expect(200);

      const deactivatedTemplate = response.body.find(
        (t: any) => t.id === templateId,
      );
      expect(deactivatedTemplate).toBeUndefined();
    });

    it('should show deactivated templates when includeInactive=true', async () => {
      const response = await request(app.getHttpServer())
        .get('/cafe-admin/tasks/templates?includeInactive=true')
        .set('Authorization', `Bearer ${cafeAdminToken}`)
        .expect(200);

      const deactivatedTemplate = response.body.find(
        (t: any) => t.id === templateId,
      );
      expect(deactivatedTemplate).toBeDefined();
      expect(deactivatedTemplate.isActive).toBe(false);
    });
  });

  describe('Worker - Task Operations', () => {
    let allWorkersTemplateId: string;
    let specificWorkerTemplateId: string;
    const today = new Date().toISOString().split('T')[0];

    beforeAll(async () => {
      // Create templates for worker tests
      const allWorkersTemplate = await request(app.getHttpServer())
        .post('/cafe-admin/tasks/templates')
        .set('Authorization', `Bearer ${cafeAdminToken}`)
        .send({
          title: 'Check Supplies',
          category: TaskCategory.OPENING,
          priority: TaskPriority.HIGH,
          assignmentType: TaskAssignmentType.ALL_WORKERS,
          daysOfWeek: [],
        })
        .expect(201);
      allWorkersTemplateId = allWorkersTemplate.body.id;

      const specificWorkerTemplate = await request(app.getHttpServer())
        .post('/cafe-admin/tasks/templates')
        .set('Authorization', `Bearer ${cafeAdminToken}`)
        .send({
          title: 'Restock Cups',
          category: TaskCategory.SHIFT,
          priority: TaskPriority.MEDIUM,
          assignmentType: TaskAssignmentType.SPECIFIC_WORKERS,
          assignedWorkerIds: [worker1Id],
          daysOfWeek: [],
        })
        .expect(201);
      specificWorkerTemplateId = specificWorkerTemplate.body.id;
    });

    it('worker1 should see both ALL_WORKERS and SPECIFIC_WORKERS tasks', async () => {
      const response = await request(app.getHttpServer())
        .get(`/cafe-worker/tasks?date=${today}`)
        .set('Authorization', `Bearer ${worker1Token}`)
        .expect(200);

      expect(response.body).toHaveProperty('tasks');
      expect(response.body).toHaveProperty('completedCount');
      expect(response.body).toHaveProperty('totalCount');
      expect(Array.isArray(response.body.tasks)).toBe(true);

      const taskIds = response.body.tasks.map((t: any) => t.id);
      expect(taskIds).toContain(allWorkersTemplateId);
      expect(taskIds).toContain(specificWorkerTemplateId);
    });

    it('worker2 should see only ALL_WORKERS tasks', async () => {
      const response = await request(app.getHttpServer())
        .get(`/cafe-worker/tasks?date=${today}`)
        .set('Authorization', `Bearer ${worker2Token}`)
        .expect(200);

      const taskIds = response.body.tasks.map((t: any) => t.id);
      expect(taskIds).toContain(allWorkersTemplateId);
      expect(taskIds).not.toContain(specificWorkerTemplateId);
    });

    it('worker1 should complete a task', async () => {
      const response = await request(app.getHttpServer())
        .post(`/cafe-worker/tasks/${allWorkersTemplateId}/complete`)
        .set('Authorization', `Bearer ${worker1Token}`)
        .send({
          completionDate: today,
          durationMinutes: 8,
        })
        .expect(201);

      expect(response.body.completed).toBe(true);
      expect(response.body.durationMinutes).toBe(8);
    });

    it('worker1 should see completed task in task list', async () => {
      const response = await request(app.getHttpServer())
        .get(`/cafe-worker/tasks?date=${today}`)
        .set('Authorization', `Bearer ${worker1Token}`)
        .expect(200);

      const completedTask = response.body.tasks.find(
        (t: any) => t.id === allWorkersTemplateId,
      );
      expect(completedTask.completed).toBe(true);
      expect(response.body.completedCount).toBeGreaterThan(0);
    });

    it('should fail to complete same task twice', async () => {
      await request(app.getHttpServer())
        .post(`/cafe-worker/tasks/${allWorkersTemplateId}/complete`)
        .set('Authorization', `Bearer ${worker1Token}`)
        .send({
          completionDate: today,
        })
        .expect(400);
    });

    it('worker1 should uncomplete a task', async () => {
      await request(app.getHttpServer())
        .delete(
          `/cafe-worker/tasks/${allWorkersTemplateId}/complete?date=${today}`,
        )
        .set('Authorization', `Bearer ${worker1Token}`)
        .expect(200);

      // Verify task is no longer completed
      const response = await request(app.getHttpServer())
        .get(`/cafe-worker/tasks?date=${today}`)
        .set('Authorization', `Bearer ${worker1Token}`)
        .expect(200);

      const task = response.body.tasks.find(
        (t: any) => t.id === allWorkersTemplateId,
      );
      expect(task.completed).toBe(false);
    });

    it('should fail to complete task requiring photo without photo', async () => {
      // Create template requiring photo
      const templateWithPhoto = await request(app.getHttpServer())
        .post('/cafe-admin/tasks/templates')
        .set('Authorization', `Bearer ${cafeAdminToken}`)
        .send({
          title: 'Clean with Photo',
          category: TaskCategory.CLOSING,
          priority: TaskPriority.HIGH,
          assignmentType: TaskAssignmentType.ALL_WORKERS,
          requiresPhoto: true,
          daysOfWeek: [],
        })
        .expect(201);

      await request(app.getHttpServer())
        .post(`/cafe-worker/tasks/${templateWithPhoto.body.id}/complete`)
        .set('Authorization', `Bearer ${worker1Token}`)
        .send({
          completionDate: today,
          // Missing photoUrl
        })
        .expect(400);
    });

    it('should complete task with photo when required', async () => {
      // Create template requiring photo
      const templateWithPhoto = await request(app.getHttpServer())
        .post('/cafe-admin/tasks/templates')
        .set('Authorization', `Bearer ${cafeAdminToken}`)
        .send({
          title: 'Clean with Photo 2',
          category: TaskCategory.CLOSING,
          priority: TaskPriority.HIGH,
          assignmentType: TaskAssignmentType.ALL_WORKERS,
          requiresPhoto: true,
          daysOfWeek: [],
        })
        .expect(201);

      const response = await request(app.getHttpServer())
        .post(`/cafe-worker/tasks/${templateWithPhoto.body.id}/complete`)
        .set('Authorization', `Bearer ${worker1Token}`)
        .send({
          completionDate: today,
          photoUrl: 'https://example.com/photo.jpg',
        })
        .expect(201);

      expect(response.body.completed).toBe(true);
      expect(response.body.photoUrl).toBe('https://example.com/photo.jpg');
    });

    it('should complete task with comment when required', async () => {
      // Create template requiring comment
      const templateWithComment = await request(app.getHttpServer())
        .post('/cafe-admin/tasks/templates')
        .set('Authorization', `Bearer ${cafeAdminToken}`)
        .send({
          title: 'Task with Comment',
          category: TaskCategory.SHIFT,
          priority: TaskPriority.MEDIUM,
          assignmentType: TaskAssignmentType.ALL_WORKERS,
          requiresComment: true,
          daysOfWeek: [],
        })
        .expect(201);

      const response = await request(app.getHttpServer())
        .post(`/cafe-worker/tasks/${templateWithComment.body.id}/complete`)
        .set('Authorization', `Bearer ${worker1Token}`)
        .send({
          completionDate: today,
          comment: 'Everything is fine',
        })
        .expect(201);

      expect(response.body.completed).toBe(true);
      expect(response.body.comment).toBe('Everything is fine');
    });
  });

  describe('Cafe Admin - Statistics', () => {
    let statsTemplateId: string;
    const today = new Date().toISOString().split('T')[0];
    const tomorrow = new Date(Date.now() + 86400000)
      .toISOString()
      .split('T')[0];

    beforeAll(async () => {
      // Create template for statistics
      const template = await request(app.getHttpServer())
        .post('/cafe-admin/tasks/templates')
        .set('Authorization', `Bearer ${cafeAdminToken}`)
        .send({
          title: 'Stats Task',
          category: TaskCategory.SHIFT,
          priority: TaskPriority.MEDIUM,
          assignmentType: TaskAssignmentType.ALL_WORKERS,
          daysOfWeek: [],
        })
        .expect(201);
      statsTemplateId = template.body.id;

      // Complete task by both workers
      await request(app.getHttpServer())
        .post(`/cafe-worker/tasks/${statsTemplateId}/complete`)
        .set('Authorization', `Bearer ${worker1Token}`)
        .send({
          completionDate: today,
          durationMinutes: 10,
        })
        .expect(201);

      await request(app.getHttpServer())
        .post(`/cafe-worker/tasks/${statsTemplateId}/complete`)
        .set('Authorization', `Bearer ${worker2Token}`)
        .send({
          completionDate: today,
          durationMinutes: 12,
        })
        .expect(201);
    });

    it('should get task statistics', async () => {
      const response = await request(app.getHttpServer())
        .get(
          `/cafe-admin/tasks/statistics?fromDate=${today}&toDate=${tomorrow}`,
        )
        .set('Authorization', `Bearer ${cafeAdminToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('totalCompletions');
      expect(response.body).toHaveProperty('totalTemplates');
      expect(response.body).toHaveProperty('taskStats');
      expect(response.body).toHaveProperty('workerStats');
      expect(response.body.totalCompletions).toBeGreaterThan(0);
      expect(Array.isArray(response.body.taskStats)).toBe(true);
      expect(Array.isArray(response.body.workerStats)).toBe(true);
    });

    it('should get completion history for template', async () => {
      const response = await request(app.getHttpServer())
        .get(
          `/cafe-admin/tasks/templates/${statsTemplateId}/completions?fromDate=${today}&toDate=${tomorrow}`,
        )
        .set('Authorization', `Bearer ${cafeAdminToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('completions');
      expect(response.body).toHaveProperty('total');
      expect(response.body).toHaveProperty('page');
      expect(response.body).toHaveProperty('pageSize');
      expect(Array.isArray(response.body.completions)).toBe(true);
      expect(response.body.total).toBeGreaterThanOrEqual(2);
    });

    it('should paginate completion history', async () => {
      const response = await request(app.getHttpServer())
        .get(
          `/cafe-admin/tasks/templates/${statsTemplateId}/completions?fromDate=${today}&toDate=${tomorrow}&page=1&pageSize=1`,
        )
        .set('Authorization', `Bearer ${cafeAdminToken}`)
        .expect(200);

      expect(response.body.completions.length).toBe(1);
      expect(response.body.page).toBe(1);
      expect(response.body.pageSize).toBe(1);
    });
  });

  describe('Day of Week Filtering', () => {
    let mondayOnlyTemplateId: string;
    let weekendOnlyTemplateId: string;

    beforeAll(async () => {
      // Create Monday-only template
      const mondayTemplate = await request(app.getHttpServer())
        .post('/cafe-admin/tasks/templates')
        .set('Authorization', `Bearer ${cafeAdminToken}`)
        .send({
          title: 'Monday Only Task',
          category: TaskCategory.OPENING,
          priority: TaskPriority.LOW,
          assignmentType: TaskAssignmentType.ALL_WORKERS,
          daysOfWeek: [1], // Monday only
        })
        .expect(201);
      mondayOnlyTemplateId = mondayTemplate.body.id;

      // Create weekend-only template
      const weekendTemplate = await request(app.getHttpServer())
        .post('/cafe-admin/tasks/templates')
        .set('Authorization', `Bearer ${cafeAdminToken}`)
        .send({
          title: 'Weekend Only Task',
          category: TaskCategory.OPENING,
          priority: TaskPriority.LOW,
          assignmentType: TaskAssignmentType.ALL_WORKERS,
          daysOfWeek: [6, 7], // Saturday, Sunday
        })
        .expect(201);
      weekendOnlyTemplateId = weekendTemplate.body.id;
    });

    it('should filter tasks by day of week', async () => {
      // Get current day of week (1=Mon, 7=Sun)
      const now = new Date();
      const dayOfWeek = now.getDay() === 0 ? 7 : now.getDay();
      const today = now.toISOString().split('T')[0];

      const response = await request(app.getHttpServer())
        .get(`/cafe-worker/tasks?date=${today}`)
        .set('Authorization', `Bearer ${worker1Token}`)
        .expect(200);

      const taskIds = response.body.tasks.map((t: any) => t.id);

      // Monday task should only appear on Monday
      if (dayOfWeek === 1) {
        expect(taskIds).toContain(mondayOnlyTemplateId);
      } else {
        expect(taskIds).not.toContain(mondayOnlyTemplateId);
      }

      // Weekend task should only appear on Saturday/Sunday
      if (dayOfWeek === 6 || dayOfWeek === 7) {
        expect(taskIds).toContain(weekendOnlyTemplateId);
      } else {
        expect(taskIds).not.toContain(weekendOnlyTemplateId);
      }
    });
  });

  describe('Authorization', () => {
    it('worker should not be able to create templates', async () => {
      await request(app.getHttpServer())
        .post('/cafe-admin/tasks/templates')
        .set('Authorization', `Bearer ${worker1Token}`)
        .send({
          title: 'Unauthorized Task',
          category: TaskCategory.SHIFT,
          priority: TaskPriority.LOW,
          assignmentType: TaskAssignmentType.ALL_WORKERS,
        })
        .expect(403); // Worker can access endpoint but should be forbidden
    });

    it('worker should not be able to view statistics', async () => {
      const today = new Date().toISOString().split('T')[0];
      const tomorrow = new Date(Date.now() + 86400000)
        .toISOString()
        .split('T')[0];

      await request(app.getHttpServer())
        .get(
          `/cafe-admin/tasks/statistics?fromDate=${today}&toDate=${tomorrow}`,
        )
        .set('Authorization', `Bearer ${worker1Token}`)
        .expect(403); // Worker can access endpoint but should be forbidden
    });
  });
});
