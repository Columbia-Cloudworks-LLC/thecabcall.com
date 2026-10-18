import fs from "node:fs";
import path from "node:path";
import { registerHooks } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";
import ts from "typescript";

const rootDir = process.cwd();

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier.startsWith("@/")) {
      const candidateBase = path.join(rootDir, "src", specifier.slice(2));
      for (const ext of ["", ".ts", ".tsx", "/index.ts", "/index.tsx"]) {
        const full = candidateBase + ext;
        if (fs.existsSync(full) && fs.statSync(full).isFile()) {
          return nextResolve(pathToFileURL(full).href, context);
        }
      }
    }

    if (
      (specifier.startsWith("./") || specifier.startsWith("../")) &&
      context.parentURL &&
      context.parentURL.startsWith("file:")
    ) {
      const parentDir = path.dirname(fileURLToPath(context.parentURL));
      const candidateBase = path.resolve(parentDir, specifier);
      for (const ext of ["", ".ts", ".tsx", "/index.ts", "/index.tsx"]) {
        const full = candidateBase + ext;
        if (fs.existsSync(full) && fs.statSync(full).isFile()) {
          return nextResolve(pathToFileURL(full).href, context);
        }
      }
    }

    return nextResolve(specifier, context);
  },

  load(url, context, nextLoad) {
    if (url.startsWith("file:") && (url.endsWith(".ts") || url.endsWith(".tsx"))) {
      const filePath = fileURLToPath(url);
      const sourceText = fs.readFileSync(filePath, "utf8");
      const transpiled = ts.transpileModule(sourceText, {
        fileName: filePath,
        compilerOptions: {
          module: ts.ModuleKind.ESNext,
          target: ts.ScriptTarget.ES2022,
          moduleResolution: ts.ModuleResolutionKind.Bundler,
          jsx: ts.JsxEmit.ReactJSX,
          esModuleInterop: true,
        },
      });
      return {
        format: "module",
        shortCircuit: true,
        source: transpiled.outputText,
      };
    }
    return nextLoad(url, context);
  },
});
