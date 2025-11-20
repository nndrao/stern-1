# @stern/openfin-platform

Reusable OpenFin platform library with dock management, theming, IAB events, and workspace services.

## Features

- **Platform Provider**: Complete OpenFin workspace platform initialization
- **Dock Management**: Dynamic dock registration with custom buttons and menus
- **Theme Management**: Bidirectional theme synchronization between dock and applications
- **IAB Events**: Type-safe Inter-Application Bus event system
- **Workspace Services**: Hooks for view/window management, theme control, and more
- **Component Wrapper**: HOC for creating OpenFin-aware React components
- **Dependency Injection**: Clean interfaces for logger, config service, and view manager

## Installation

```bash
npm install @stern/openfin-platform
```

## Peer Dependencies

```json
{
  "@openfin/core": ">=42.0.0",
  "@openfin/workspace": ">=22.0.0",
  "@openfin/workspace-platform": ">=22.0.0",
  "react": ">=18.0.0",
  "react-dom": ">=18.0.0"
}
```

## Quick Start

### 1. Initialize Platform

```typescript
import { platformContext, ConsoleLogger } from '@stern/openfin-platform';

// Initialize with optional services
platformContext.initialize({
  logger: new ConsoleLogger(),
  configService: myConfigService, // Optional
  viewManager: myViewManager, // Optional
  theme: {
    default: 'dark',
    palettes: {
      light: { /* ... */ },
      dark: { /* ... */ }
    }
  }
});
```

### 2. Use Hooks

```typescript
import { useOpenfinWorkspace, useOpenFinEvents } from '@stern/openfin-platform';

function MyComponent() {
  const { getCurrentTheme, setTheme } = useOpenfinWorkspace();

  // Listen to theme changes
  useOpenFinEvents('THEME_CHANGE', (data) => {
    console.log('Theme changed:', data.theme);
  });

  return <div>...</div>;
}
```

### 3. Register Dock

```typescript
import { dockRegister } from '@stern/openfin-platform';

await dockRegister(dockConfig);
```

## Dependency Injection

The library uses dependency injection for flexibility:

### Logger Interface

```typescript
interface ILogger {
  info(message: string, data?: any, context?: string): void;
  warn(message: string, data?: any, context?: string): void;
  error(message: string, error?: any, context?: string): void;
  debug(message: string, data?: any, context?: string): void;
}
```

### Config Service Interface

```typescript
interface IConfigService {
  loadDockConfig(userId: string): Promise<any>;
  saveDockConfig(userId: string, config: any): Promise<void>;
  loadAppConfig(appId: string): Promise<any>;
  saveAppConfig(appId: string, config: any): Promise<void>;
}
```

## API Documentation

See [API.md](./API.md) for complete API documentation.

## License

MIT
