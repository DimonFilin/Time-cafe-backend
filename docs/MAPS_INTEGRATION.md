# Интеграция картографических сервисов

## Обзор

Система поддерживает интеграцию с различными картографическими сервисами для выбора координат кофеен и геокодинга адресов.

## API эндпоинты

### Геокодинг (адрес → координаты)

**POST** `/cafes/geocode`

Преобразует адрес в координаты используя Nominatim (OpenStreetMap).

**Запрос:**

```json
{
  "address": "Moscow, Red Square, 1"
}
```

**Ответ:**

```json
{
  "latitude": 55.7539,
  "longitude": 37.6208,
  "formattedAddress": "Red Square, 1, Moscow, Russia",
  "city": "Moscow",
  "country": "Russia"
}
```

### Обратный геокодинг (координаты → адрес)

**POST** `/cafes/reverse-geocode`

Преобразует координаты в адрес используя Nominatim (OpenStreetMap).

**Запрос:**

```json
{
  "latitude": 55.7539,
  "longitude": 37.6208
}
```

**Ответ:**

```json
{
  "formattedAddress": "Red Square, 1, Moscow, Russia",
  "city": "Moscow",
  "country": "Russia",
  "street": "Red Square"
}
```

## Интеграция на фронтенде

### 1. Leaflet + OpenStreetMap (рекомендуется)

**Установка:**

```bash
npm install leaflet react-leaflet
npm install --save-dev @types/leaflet
```

**Пример использования:**

```typescript
import { MapContainer, TileLayer, Marker, useMapEvents } from 'react-leaflet';
import { useState } from 'react';
import 'leaflet/dist/leaflet.css';

function LocationPicker({ onLocationSelect }) {
  const [position, setPosition] = useState([55.7558, 37.6173]);

  useMapEvents({
    click(e) {
      const { lat, lng } = e.latlng;
      setPosition([lat, lng]);
      onLocationSelect({ latitude: lat, longitude: lng });
    },
  });

  return (
    <MapContainer
      center={[55.7558, 37.6173]}
      zoom={13}
      style={{ height: '400px', width: '100%' }}
    >
      <TileLayer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
      />
      <Marker position={position} />
    </MapContainer>
  );
}
```

**Преимущества:**

- Бесплатно и без лимитов
- Не требует API ключей
- Открытый исходный код
- Хорошая документация

### 2. Yandex Maps

**Установка:**

```bash
npm install @pbe/react-yandex-maps
```

**Пример использования:**

```typescript
import { YMaps, Map, Placemark } from '@pbe/react-yandex-maps';

function YandexMapPicker({ onLocationSelect, initialCoords }) {
  return (
    <YMaps>
      <Map
        defaultState={{
          center: initialCoords || [55.75, 37.57],
          zoom: 10
        }}
        onClick={(e) => {
          const coords = e.get('coords');
          onLocationSelect({
            latitude: coords[0],
            longitude: coords[1]
          });
        }}
        style={{ width: '100%', height: '400px' }}
      >
        <Placemark geometry={initialCoords || [55.75, 37.57]} />
      </Map>
    </YMaps>
  );
}
```

**Как работает выбор координат:**

1. Пользователь кликает на карте
2. Событие `onClick` получает координаты через `e.get('coords')`
3. Координаты передаются в `onLocationSelect` как `{ latitude, longitude }`
4. Эти координаты можно использовать для создания/обновления кофейни

**Геокодинг через Yandex API:**

```typescript
// Для геокодинга можно использовать Yandex Geocoder API
// или использовать наш бэкенд эндпоинт /cafes/geocode
const response = await fetch('/api/cafes/geocode', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ address: 'Moscow, Red Square, 1' }),
});
const { latitude, longitude } = await response.json();
```

**Обратный геокодинг через Yandex API:**

```typescript
// Или использовать наш бэкенд эндпоинт /cafes/reverse-geocode
const response = await fetch('/api/cafes/reverse-geocode', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    latitude: 55.7539,
    longitude: 37.6208,
  }),
});
const { formattedAddress, city, country } = await response.json();
```

### 3. Google Maps

**Установка:**

```bash
npm install @react-google-maps/api
```

**Пример использования:**

```typescript
import { GoogleMap, Marker, useJsApiLoader } from '@react-google-maps/api';

const libraries = ['places'];

function GoogleMapPicker({ onLocationSelect, initialCoords }) {
  const { isLoaded } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: process.env.REACT_APP_GOOGLE_MAPS_API_KEY,
    libraries,
  });

  const handleMapClick = (e) => {
    const lat = e.latLng.lat();
    const lng = e.latLng.lng();
    onLocationSelect({ latitude: lat, longitude: lng });
  };

  if (!isLoaded) return <div>Loading...</div>;

  return (
    <GoogleMap
      mapContainerStyle={{ width: '100%', height: '400px' }}
      center={initialCoords || { lat: 55.7558, lng: 37.6173 }}
      zoom={13}
      onClick={handleMapClick}
    >
      <Marker
        position={initialCoords || { lat: 55.7558, lng: 37.6173 }}
      />
    </GoogleMap>
  );
}
```

**Как работает выбор координат:**

1. Пользователь кликает на карте
2. Событие `onClick` получает объект `e.latLng`
3. Координаты извлекаются через `e.latLng.lat()` и `e.latLng.lng()`
4. Координаты передаются в `onLocationSelect` как `{ latitude, longitude }`

**Геокодинг через Google Geocoding API:**

```typescript
// Можно использовать Google Geocoding API напрямую
// или использовать наш бэкенд эндпоинт /cafes/geocode
const geocoder = new window.google.maps.Geocoder();
geocoder.geocode({ address: 'Moscow, Red Square, 1' }, (results, status) => {
  if (status === 'OK') {
    const { lat, lng } = results[0].geometry.location;
    // Использовать lat(), lng()
  }
});
```

**Обратный геокодинг через Google Geocoding API:**

```typescript
// Или использовать наш бэкенд эндпоинт /cafes/reverse-geocode
const geocoder = new window.google.maps.Geocoder();
geocoder.geocode(
  { location: { lat: 55.7539, lng: 37.6208 } },
  (results, status) => {
    if (status === 'OK') {
      const address = results[0].formatted_address;
      // Использовать адрес
    }
  },
);
```

## Обратный геокодинг - как это работает

Обратный геокодинг преобразует координаты (широта, долгота) в читаемый адрес.

**Процесс:**

1. Пользователь выбирает точку на карте (клик или маркер)
2. Получаем координаты: `{ latitude: 55.7539, longitude: 37.6208 }`
3. Отправляем запрос на `/cafes/reverse-geocode`:
   ```json
   {
     "latitude": 55.7539,
     "longitude": 37.6208
   }
   ```
4. Бэкенд использует Nominatim API для получения адреса
5. Возвращаем структурированный адрес:
   ```json
   {
     "formattedAddress": "Red Square, 1, Moscow, Russia",
     "city": "Moscow",
     "country": "Russia",
     "street": "Red Square"
   }
   ```
6. Автоматически заполняем поля формы создания кофейни

**Использование:**

```typescript
// После выбора координат на карте
const handleLocationSelect = async (coords) => {
  // Сохраняем координаты
  setFormData({ ...formData, ...coords });

  // Получаем адрес через обратный геокодинг
  const response = await fetch('/api/cafes/reverse-geocode', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(coords),
  });

  const addressData = await response.json();

  // Автоматически заполняем адрес
  setFormData({
    ...formData,
    ...coords,
    address: addressData.formattedAddress,
    city: addressData.city || '',
    street: addressData.street || '',
  });
};
```

## Рекомендации

1. **Для России/СНГ:** Используйте Yandex Maps - лучшая точность для российских адресов
2. **Для международных проектов:** Используйте Leaflet + OpenStreetMap - бесплатно и без лимитов
3. **Для коммерческих проектов:** Google Maps - лучшая интеграция с другими сервисами Google

## Ограничения Nominatim

- **Rate limiting:** 1 запрос в секунду (рекомендуется кеширование)
- **User-Agent:** Обязательно указывать User-Agent в запросах
- **Точность:** Может быть ниже, чем у коммерческих сервисов

## Поиск ближайших кофеен

Поиск ближайших кофеен уже реализован в API `/cafes`:

```
GET /cafes?latitude=55.7539&longitude=37.6208&radius=5&sortBy=distance&sortOrder=asc
```

Параметры:

- `latitude`, `longitude` - координаты пользователя
- `radius` - радиус поиска в километрах
- `sortBy=distance` - сортировка по расстоянию
- `sortOrder=asc` - от ближайших к дальним
