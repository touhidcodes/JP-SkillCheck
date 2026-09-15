const fs = require('fs');
const path = require('path');

const SRC_DIR = path.resolve(__dirname, '../src');
if (!fs.existsSync(SRC_DIR)) {
  console.error(`Source directory does not exist: ${SRC_DIR}`);
  process.exit(1);
}

// Map alias to path
const ALIAS_PREFIX = '@/';
const ALIAS_TARGET = SRC_DIR;

function getFiles(dir, fileList = []) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    if (stat.isDirectory()) {
      if (file !== 'node_modules' && file !== '.next') {
        getFiles(filePath, fileList);
      }
    } else if (filePath.endsWith('.ts') || filePath.endsWith('.tsx')) {
      fileList.push(filePath);
    }
  }
  return fileList;
}

function resolveImport(importPath, currentFilePath) {
  let resolvedPath = '';
  if (importPath.startsWith(ALIAS_PREFIX)) {
    resolvedPath = path.join(ALIAS_TARGET, importPath.substring(ALIAS_PREFIX.length));
  } else if (importPath.startsWith('.') || importPath.startsWith('..')) {
    resolvedPath = path.resolve(path.dirname(currentFilePath), importPath);
  } else {
    // Third party or node_modules
    return null;
  }

  // Try extensions
  const extensions = ['.ts', '.tsx', '/index.ts', '/index.tsx', '.d.ts'];
  if (fs.existsSync(resolvedPath) && fs.statSync(resolvedPath).isFile()) {
    return resolvedPath;
  }
  for (const ext of extensions) {
    const p = resolvedPath + ext;
    if (fs.existsSync(p) && fs.statSync(p).isFile()) {
      return p;
    }
  }
  return null;
}

const graph = {};
const allFiles = getFiles(SRC_DIR);

// Build graph
for (const file of allFiles) {
  const relativeFile = path.relative(SRC_DIR, file);
  graph[relativeFile] = [];
  const content = fs.readFileSync(file, 'utf-8');
  
  // Extract imports
  // Matches: import ... from '...' or import '...'
  const importRegex = /(?:import|export)\s+(?:[\s\S]*?\s+from\s+)?['"]([^'"]+)['"]/g;
  let match;
  while ((match = importRegex.exec(content)) !== null) {
    const importStr = match[1];
    const resolved = resolveImport(importStr, file);
    if (resolved) {
      const relativeImport = path.relative(SRC_DIR, resolved);
      if (!graph[relativeFile].includes(relativeImport)) {
        graph[relativeFile].push(relativeImport);
      }
    }
  }
}

// DFS to detect cycles
const visited = {};
const recStack = {};
const cycles = [];

function dfs(node, pathStack = []) {
  visited[node] = true;
  recStack[node] = true;
  pathStack.push(node);

  const neighbors = graph[node] || [];
  for (const neighbor of neighbors) {
    if (!visited[neighbor]) {
      dfs(neighbor, pathStack);
    } else if (recStack[neighbor]) {
      const cyclePath = pathStack.slice(pathStack.indexOf(neighbor));
      cyclePath.push(neighbor);
      cycles.push(cyclePath);
    }
  }

  pathStack.pop();
  recStack[node] = false;
}

for (const node of Object.keys(graph)) {
  if (!visited[node]) {
    dfs(node);
  }
}

if (cycles.length > 0) {
  console.log(`❌ FAILED: Found ${cycles.length} circular dependencies:\n`);
  cycles.forEach((cycle, index) => {
    console.log(`${index + 1}: ${cycle.join(' -> ')}`);
  });
  process.exit(1);
} else {
  console.log('✅ PASSED: No circular dependencies found!');
  process.exit(0);
}
