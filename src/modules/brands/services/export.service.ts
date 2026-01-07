import { Injectable } from '@nestjs/common';
import { BrandReportDto } from '../dto/brand-report.dto';
import * as ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  Table,
  TableRow,
  TableCell,
} from 'docx';

export enum ExportFormat {
  EXCEL = 'excel',
  PDF = 'pdf',
  DOCX = 'docx',
  CSV = 'csv',
}

@Injectable()
export class ExportService {
  /**
   * Export brand report to Excel format
   */
  async exportToExcel(report: BrandReportDto): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Brand Report');

    // Brand Information
    worksheet.addRow(['Brand Report']);
    worksheet.mergeCells('A1:B1');
    worksheet.getCell('A1').font = { size: 16, bold: true };
    worksheet.addRow([]);

    worksheet.addRow(['Brand Information']);
    worksheet.getRow(3).font = { bold: true };
    worksheet.addRow(['Brand Name:', report.brand.name]);
    worksheet.addRow(['Status:', report.brand.status]);
    worksheet.addRow(['Verified:', report.brand.isVerified ? 'Yes' : 'No']);
    worksheet.addRow([]);

    // Statistics
    worksheet.addRow(['Statistics']);
    worksheet.getRow(8).font = { bold: true };
    worksheet.addRow(['Total Cafes:', report.statistics.totalCafes]);
    worksheet.addRow(['Active Cafes:', report.statistics.activeCafes]);
    worksheet.addRow(['Average Rating:', report.statistics.averageRating]);
    worksheet.addRow(['Total Reviews:', report.statistics.totalReviews]);
    worksheet.addRow([]);

    // Cafes Table
    worksheet.addRow(['Cafes']);
    worksheet.getRow(14).font = { bold: true };
    const headerRow = worksheet.addRow([
      'Name',
      'Address',
      'City',
      'Rating',
      'Reviews',
      'Created At',
    ]);
    headerRow.font = { bold: true };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE0E0E0' },
    };

    report.cafes.forEach((cafe) => {
      worksheet.addRow([
        cafe.name,
        cafe.address,
        cafe.city,
        cafe.rating,
        cafe.reviewsCount,
        cafe.createdAt.toISOString().split('T')[0],
      ]);
    });

    // Auto-fit columns
    worksheet.columns.forEach((column) => {
      if (column.eachCell) {
        let maxLength = 0;
        column.eachCell({ includeEmpty: false }, (cell) => {
          let columnLength = 10;
          if (cell.value !== null && cell.value !== undefined) {
            let valueStr: string;
            if (typeof cell.value === 'string') {
              valueStr = cell.value;
            } else if (typeof cell.value === 'number') {
              valueStr = cell.value.toString();
            } else if (typeof cell.value === 'boolean') {
              valueStr = cell.value.toString();
            } else if (cell.value instanceof Date) {
              valueStr = cell.value.toISOString();
            } else {
              valueStr = JSON.stringify(cell.value);
            }
            columnLength = valueStr.length;
          }
          if (columnLength > maxLength) {
            maxLength = columnLength;
          }
        });
        column.width = Math.min(maxLength + 2, 50);
      }
    });

    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }

  /**
   * Export brand report to PDF format
   */
  async exportToPdf(report: BrandReportDto): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ margin: 50 });
      const buffers: Buffer[] = [];

      doc.on('data', (chunk: Buffer) => {
        buffers.push(chunk);
      });
      doc.on('end', () => {
        const pdfBuffer = Buffer.concat(buffers);
        resolve(pdfBuffer);
      });
      doc.on('error', (error: Error) => {
        reject(error);
      });

      // Title
      doc.fontSize(20).text('Brand Report', { align: 'center' });
      doc.moveDown();

      // Brand Information
      doc.fontSize(16).text('Brand Information', { underline: true });
      doc.moveDown(0.5);
      doc.fontSize(12);
      doc.text(`Brand Name: ${report.brand.name}`);
      doc.text(`Status: ${report.brand.status}`);
      doc.text(`Verified: ${report.brand.isVerified ? 'Yes' : 'No'}`);
      doc.moveDown();

      // Statistics
      doc.fontSize(16).text('Statistics', { underline: true });
      doc.moveDown(0.5);
      doc.fontSize(12);
      doc.text(`Total Cafes: ${report.statistics.totalCafes}`);
      doc.text(`Active Cafes: ${report.statistics.activeCafes}`);
      doc.text(`Average Rating: ${report.statistics.averageRating}`);
      doc.text(`Total Reviews: ${report.statistics.totalReviews}`);
      doc.moveDown();

      // Cafes
      doc.fontSize(16).text('Cafes', { underline: true });
      doc.moveDown(0.5);
      doc.fontSize(12);

      report.cafes.forEach((cafe, index) => {
        if (index > 0) doc.moveDown(0.5);
        doc.text(`${index + 1}. ${cafe.name}`, { continued: false });
        doc.text(`   Address: ${cafe.address}`, { indent: 20 });
        doc.text(`   City: ${cafe.city}`, { indent: 20 });
        doc.text(`   Rating: ${cafe.rating} | Reviews: ${cafe.reviewsCount}`, {
          indent: 20,
        });
      });

      doc.end();
    });
  }

  /**
   * Export brand report to DOCX format
   */
  async exportToDocx(report: BrandReportDto): Promise<Buffer> {
    const doc = new Document({
      sections: [
        {
          children: [
            new Paragraph({
              children: [
                new TextRun({
                  text: 'Brand Report',
                  bold: true,
                  size: 32,
                }),
              ],
              alignment: 'center',
            }),
            new Paragraph({ text: '' }),
            new Paragraph({
              children: [
                new TextRun({
                  text: 'Brand Information',
                  bold: true,
                  size: 24,
                }),
              ],
            }),
            new Paragraph({
              text: `Brand Name: ${report.brand.name}`,
            }),
            new Paragraph({
              text: `Status: ${report.brand.status}`,
            }),
            new Paragraph({
              text: `Verified: ${report.brand.isVerified ? 'Yes' : 'No'}`,
            }),
            new Paragraph({ text: '' }),
            new Paragraph({
              children: [
                new TextRun({
                  text: 'Statistics',
                  bold: true,
                  size: 24,
                }),
              ],
            }),
            new Paragraph({
              text: `Total Cafes: ${report.statistics.totalCafes}`,
            }),
            new Paragraph({
              text: `Active Cafes: ${report.statistics.activeCafes}`,
            }),
            new Paragraph({
              text: `Average Rating: ${report.statistics.averageRating}`,
            }),
            new Paragraph({
              text: `Total Reviews: ${report.statistics.totalReviews}`,
            }),
            new Paragraph({ text: '' }),
            new Paragraph({
              children: [
                new TextRun({
                  text: 'Cafes',
                  bold: true,
                  size: 24,
                }),
              ],
            }),
            new Table({
              columnWidths: [2000, 2000, 1500, 1000, 1000, 2000],
              rows: [
                new TableRow({
                  children: [
                    new TableCell({
                      children: [new Paragraph('Name')],
                    }),
                    new TableCell({
                      children: [new Paragraph('Address')],
                    }),
                    new TableCell({
                      children: [new Paragraph('City')],
                    }),
                    new TableCell({
                      children: [new Paragraph('Rating')],
                    }),
                    new TableCell({
                      children: [new Paragraph('Reviews')],
                    }),
                    new TableCell({
                      children: [new Paragraph('Created At')],
                    }),
                  ],
                }),
                ...report.cafes.map(
                  (cafe) =>
                    new TableRow({
                      children: [
                        new TableCell({
                          children: [new Paragraph(cafe.name)],
                        }),
                        new TableCell({
                          children: [new Paragraph(cafe.address)],
                        }),
                        new TableCell({
                          children: [new Paragraph(cafe.city)],
                        }),
                        new TableCell({
                          children: [new Paragraph(cafe.rating.toString())],
                        }),
                        new TableCell({
                          children: [
                            new Paragraph(cafe.reviewsCount.toString()),
                          ],
                        }),
                        new TableCell({
                          children: [
                            new Paragraph(
                              cafe.createdAt.toISOString().split('T')[0],
                            ),
                          ],
                        }),
                      ],
                    }),
                ),
              ],
            }),
          ],
        },
      ],
    });

    const buffer = await Packer.toBuffer(doc);
    return buffer;
  }

  /**
   * Export brand report to CSV format
   */
  exportToCsv(report: BrandReportDto): Buffer {
    // Convert cafes to CSV format
    const headers = 'Name,Address,City,Rating,Reviews,Created At\n';
    const rows = report.cafes.map((cafe) =>
      [
        cafe.name,
        cafe.address,
        cafe.city,
        cafe.rating.toString(),
        cafe.reviewsCount.toString(),
        cafe.createdAt.toISOString().split('T')[0],
      ]
        .map((field) => `"${String(field).replace(/"/g, '""')}"`)
        .join(','),
    );
    const csvContent = headers + rows.join('\n');
    return Buffer.from(csvContent, 'utf-8');
  }

  /**
   * Get MIME type for export format
   */
  getMimeType(format: ExportFormat): string {
    switch (format) {
      case ExportFormat.EXCEL:
        return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
      case ExportFormat.PDF:
        return 'application/pdf';
      case ExportFormat.DOCX:
        return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
      case ExportFormat.CSV:
        return 'text/csv';
      default:
        return 'application/octet-stream';
    }
  }

  /**
   * Get file extension for export format
   */
  getFileExtension(format: ExportFormat): string {
    switch (format) {
      case ExportFormat.EXCEL:
        return 'xlsx';
      case ExportFormat.PDF:
        return 'pdf';
      case ExportFormat.DOCX:
        return 'docx';
      case ExportFormat.CSV:
        return 'csv';
      default:
        return 'bin';
    }
  }
}
