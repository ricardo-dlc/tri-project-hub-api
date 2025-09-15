# Lambda Functions Structure

This directory contains all AWS Lambda functions organized by feature domains and shared utilities.

## Structure

```
lambdas/
├── features/                    # Feature-specific code
│   ├── events/                 # Events domain
│   │   ├── handlers/           # Lambda handlers
│   │   ├── models/             # Domain models (ElectroDB entities)
│   │   ├── services/           # Business logic
│   │   └── types/              # Feature-specific types
│   └── auth/                   # Authentication domain
│       ├── handlers/           # Auth-related handlers
│       ├── models/             # User models
│       ├── services/           # Auth business logic
│       └── types/              # Auth-specific types
├── shared/                     # Shared utilities and middleware
│   ├── middleware/             # Request/response middleware
│   ├── utils/                  # Utility functions
│   ├── types/                  # Common types
│   └── constants/              # Shared constants
└── index.ts                    # Re-exports for easy imports
```

## Benefits

1. **Feature Isolation**: Each domain (events, auth) is self-contained
2. **Shared Code**: Common utilities are centralized in `shared/`
3. **Clear Separation**: Handlers, models, services, and types are organized separately
4. **Scalability**: Easy to add new features without cluttering existing code
5. **Import Simplicity**: Main index.ts provides easy access to shared utilities

## Usage

### Importing Shared Code
```typescript
import { withMiddleware, BadRequestError } from '../../../shared/middleware';
import { ddbDocClient } from '../../../shared/utils/dynamo';
```

### Or use the main index for convenience
```typescript
import { withMiddleware, BadRequestError, ddbDocClient } from '../../index';
```

### Adding New Features
1. Create a new folder under `features/`
2. Follow the same structure: `handlers/`, `models/`, `services/`, `types/`
3. Update the main `index.ts` if you want to export anything globally

## Guidelines

- Keep handlers thin - business logic goes in services
- Models should only contain ElectroDB entity definitions
- Types should be feature-specific unless they're truly shared
- Use the shared middleware for all handlers
- Follow consistent naming conventions