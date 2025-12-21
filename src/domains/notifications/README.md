# Notification Center

In-app notification system for DictateMED with real-time updates and PWA push support.

## Features

- **In-app notifications** - Bell icon dropdown with unread count badge
- **Real-time polling** - Checks for new notifications every 30 seconds
- **Toast notifications** - Pop-up alerts for new notifications while app is open
- **Mark as read** - Individual and bulk mark as read functionality
- **Notification types** - Different icons and styling for different notification types
- **Smart polling** - Pauses when page is hidden, resumes on visibility

## Notification Types

| Type | Description | Icon |
|------|-------------|------|
| `LETTER_READY` | Letter generated and ready for review | Blue file icon |
| `TRANSCRIPTION_COMPLETE` | Recording transcription finished | Green checkmark |
| `DOCUMENT_PROCESSED` | Document uploaded and processed | Purple file check |
| `REVIEW_REMINDER` | Letter pending review reminder | Orange alert |
| `SYSTEM` | System announcements | Gray bell |

## Usage

### Adding the Notification Center to your app

```tsx
import { NotificationCenter } from '@/components/layout/NotificationCenter';
import { Toaster } from '@/components/ui/toaster';

export default function Layout({ children }) {
  return (
    <div>
      <header>
        <NotificationCenter />
      </header>
      {children}
      <Toaster />
    </div>
  );
}
```

### Creating notifications programmatically

```typescript
import {
  notifyLetterReady,
  notifyTranscriptionComplete,
  notifyDocumentProcessed,
  notifyReviewReminder,
  notifySystem,
} from '@/domains/notifications';

// Letter is ready
await notifyLetterReady(userId, letterId, 'John Smith');

// Transcription complete
await notifyTranscriptionComplete(userId, recordingId, 180);

// Document processed
await notifyDocumentProcessed(
  userId,
  documentId,
  'Echo Report',
  'echo_2024_01_15.pdf'
);

// Review reminder
await notifyReviewReminder(userId, letterId, 'Jane Doe', 3);

// System notification
await notifySystem(
  userId,
  'Maintenance Scheduled',
  'System maintenance will occur on Sunday at 2am AEDT.',
  { maintenanceDate: '2024-02-18T02:00:00Z' }
);
```

### Using the hook in custom components

```typescript
import { useNotifications } from '@/hooks/useNotifications';

function MyComponent() {
  const {
    notifications,
    unreadCount,
    isLoading,
    markRead,
    markAllAsRead,
    refresh,
  } = useNotifications({
    enablePolling: true,
    pollInterval: 30000,
    showToast: true,
  });

  return (
    <div>
      <h2>Notifications ({unreadCount})</h2>
      {notifications.map((notification) => (
        <div key={notification.id}>
          <h3>{notification.title}</h3>
          <p>{notification.message}</p>
          {!notification.read && (
            <button onClick={() => markRead(notification.id)}>
              Mark as read
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
```

## API Endpoints

### GET /api/notifications

Get recent notifications for the current user.

**Query Parameters:**
- `limit` (optional): Number of notifications to return (default: 10)

**Response:**
```json
{
  "notifications": [
    {
      "id": "uuid",
      "userId": "uuid",
      "type": "LETTER_READY",
      "title": "Letter Ready for Review",
      "message": "A new letter for John Smith has been generated...",
      "read": false,
      "data": {
        "letterId": "uuid",
        "url": "/letters/uuid"
      },
      "createdAt": "2024-01-15T10:30:00Z"
    }
  ],
  "unreadCount": 3
}
```

### POST /api/notifications

Mark notification(s) as read.

**Mark single notification:**
```json
{
  "action": "markRead",
  "notificationId": "uuid"
}
```

**Mark multiple notifications:**
```json
{
  "action": "markManyRead",
  "notificationIds": ["uuid1", "uuid2", "uuid3"]
}
```

**Mark all as read:**
```json
{
  "action": "markAllRead"
}
```

## Database Schema

```prisma
model Notification {
  id        String           @id @default(uuid())
  userId    String
  user      User             @relation(fields: [userId], references: [id], onDelete: Cascade)
  type      NotificationType
  title     String
  message   String           @db.Text
  read      Boolean          @default(false)
  data      Json?
  createdAt DateTime         @default(now())

  @@index([userId, createdAt])
  @@index([userId, read])
  @@map("notifications")
}

enum NotificationType {
  LETTER_READY
  TRANSCRIPTION_COMPLETE
  DOCUMENT_PROCESSED
  REVIEW_REMINDER
  SYSTEM
}
```

## State Management

The notification system uses Zustand for state management:

- **Store**: `src/stores/notification.store.ts`
- **Hook**: `src/hooks/useNotifications.ts`

The store tracks:
- List of notifications
- Unread count
- Last checked timestamp
- Loading state
- Error state

## Performance Considerations

- **Polling interval**: 30 seconds by default (configurable)
- **Display limit**: Shows up to 10 notifications in dropdown
- **Automatic pause**: Stops polling when page is hidden
- **Toast limit**: Maximum 3 toasts shown at once
- **Auto-dismiss**: Toasts auto-dismiss after 5 seconds

## Integration with Existing Systems

### Letter Generation

Add to `src/domains/letters/letter.service.ts`:

```typescript
import { notifyLetterReady } from '@/domains/notifications';

// After letter generation
await notifyLetterReady(userId, letter.id, patientName);
```

### Transcription Webhook

Add to `src/app/api/transcription/webhook/route.ts`:

```typescript
import { notifyTranscriptionComplete } from '@/domains/notifications';

// After transcription complete
await notifyTranscriptionComplete(
  recording.userId,
  recording.id,
  recording.durationSeconds
);
```

### Document Processing

Add to `src/domains/documents/extraction.service.ts`:

```typescript
import { notifyDocumentProcessed } from '@/domains/notifications';

// After document extraction
await notifyDocumentProcessed(
  userId,
  document.id,
  document.documentType,
  document.filename
);
```

## Future Enhancements

- [ ] PWA push notifications for mobile devices
- [ ] Email notifications for critical events
- [ ] Notification preferences (per-type enable/disable)
- [ ] Desktop notifications via browser API
- [ ] Notification history page with filtering
- [ ] Batch actions (delete, archive)
- [ ] Notification sound effects
- [ ] Rich notifications with action buttons

## Testing

To test notifications:

```typescript
// Create a test notification
await notifySystem(
  userId,
  'Test Notification',
  'This is a test notification to verify the system is working.'
);
```

The notification should:
1. Appear in the notification center dropdown
2. Show unread count badge
3. Display a toast notification
4. Be markable as read
5. Disappear from unread count when marked
