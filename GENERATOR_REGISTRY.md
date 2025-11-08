# Generator Registry

Clay includes a built-in registry of known generators that can be easily installed and used in your projects. This registry provides a curated list of generators maintained by the community.

## Registry Updates

The registry is automatically fetched from GitHub every time you use generator commands, ensuring you always have access to the latest available generators. The registry is cached locally in `~/.clay/registry-cache.json` for offline use.

### Fallback Strategy

1. **First**: Attempts to fetch the latest registry from GitHub
2. **Second**: Uses cached version if GitHub is unavailable
3. **Third**: Falls back to local registry file in the repository

## Available Commands

### List Available Generators

```bash
clay generator list-available
```

Shows all generators available in the registry with their descriptions, repository URLs, and tags.

### Clear Registry Cache

```bash
clay generator clear-cache
```

Clears the local registry cache (`~/.clay/registry-cache.json`) to force fetching the latest version from GitHub on the next command.

### Add Generator by Name

```bash
clay generator add <generator-name>
```

When you provide a generator name (instead of a GitHub URL), Clay will first check the registry for a known generator with that name. If found, it will automatically clone the repository and add it to your model.

Example:

```bash
clay generator add clay-model-documentation
```

### Registry Fallback

If a generator name is not found in the registry, Clay will provide helpful suggestions:

- Provide a GitHub repository URL directly
- Install the generator globally with npm/yarn
- Use `clay generator list-available` to see available options

## Registry Structure

The registry is stored in `generator-registry.json` and contains:

- Generator name and description
- GitHub repository URL
- Tags for categorization
- Author information

## Contributing Generators

To add your generator to the registry, submit a pull request modifying `generator-registry.json` with your generator information:

```json
{
  "your-generator-name": {
    "name": "Human Readable Name",
    "description": "Brief description of what the generator does",
    "repository": "https://github.com/username/repository",
    "tags": ["tag1", "tag2"],
    "author": "your-username"
  }
}
```

### Generator Requirements

- Must contain a valid `generator.json` file in the root
- Repository must be publicly accessible
- Should follow Clay generator conventions
- Include documentation and examples
