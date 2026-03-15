# @web-loom/api-cli

Command-line interface for the Web Loom API Framework.

## Installation

```bash
npm install -g @web-loom/api-cli
```

## Usage

```bash
webloom [command] [options]
```

### Global Options

- `--debug` - Enable debug mode with verbose logging
- `--config <path>` - Path to configuration file (default: `webloom.config.ts`)
- `--no-color` - Disable colored output
- `-v, --version` - Display version number
- `-h, --help` - Display help for command

## Commands

Commands will be added in subsequent tasks:

- `webloom init` - Initialize a new Web Loom project
- `webloom generate` - Generate code (models, routes, CRUD, etc.)
- `webloom migrate` - Run database migrations
- `webloom dev` - Start development server
- `webloom seed` - Seed database with test data

## Examples

```bash
# Show help
webloom --help

# Show version
webloom --version

# Enable debug mode
webloom --debug [command]

# Use custom config file
webloom --config custom.config.ts [command]
```

## Development

```bash
# Install dependencies
npm install

# Run tests
npm test

# Build
npm run build

# Type check
npm run check-types
```

## Architecture

The CLI is built with:

- **Commander.js** - Command-line interface framework
- **Chalk** - Terminal string styling
- **Ora** - Elegant terminal spinners

### Structure

```
src/
├── cli.ts              # CLI entry point
├── program.ts          # Program configuration
├── version.ts          # Version constant
├── utils/
│   ├── logger.ts       # Logging utilities
│   ├── error-handler.ts # Error handling
│   └── index.ts        # Utility exports
└── __tests__/          # Test files
```

## License

MIT
