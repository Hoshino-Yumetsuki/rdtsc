import fs from "fs/promises";
import { compile, load } from "tsconfig-utils";
import { createRequire } from "module";
import { join, resolve } from "path";
import { rollup } from "rollup";
import dts from "rollup-plugin-dts";
import multiEntry from "@rollup/plugin-multi-entry";
import os from "os";
import path from "path";
import { mkdtemp, rm } from "fs/promises";

declare module "tsconfig-utils" {
  interface TsConfig {
    rdtsc: Config;
  }
}

export interface Config {
  inline?: string[];
  exclude?: string[];
}

async function getModules(path: string, prefix = ""): Promise<string[]> {
  const files = await fs.readdir(path, { withFileTypes: true });
  return ([] as string[]).concat(
    ...(await Promise.all(
      files.map(async (file) => {
        if (file.isDirectory()) {
          return getModules(join(path, file.name), `${prefix}${file.name}/`);
        } else if (file.name.endsWith(".ts")) {
          return [prefix + file.name.slice(0, -3)];
        } else {
          return [];
        }
      })
    ))
  );
}

export async function build(cwd: string, args: string[] = []) {
  const require = createRequire(cwd + "/");
  const config = await load(cwd, args);

  // 使用 outDir
  const outDir = config.get("outDir");
  if (!outDir) throw new Error("outDir is required");

  const rootDir = config.get("rootDir");
  if (!rootDir) throw new Error("rootDir is required");

  const manifest = require(cwd + "/package.json");

  const typesField = manifest.types || manifest.typings || "index.d.ts";
  const typesFileName = path.basename(typesField);

  const srcpath = `${cwd.replace(/\\/g, "/")}/${rootDir}`;
  const destpath = resolve(cwd, outDir, typesFileName);

  // 添加日志输出
  console.log(`rdtsc: ${rootDir}\\${typesFileName} -> ${outDir}\\${typesFileName}`);

  const tmpDir = await mkdtemp(path.join(os.tmpdir(), "rdtsc-"));

  try {
    const compileArgs = [...args];

    const outDirIndex = compileArgs.findIndex((arg) => arg === "--outDir");
    if (outDirIndex >= 0 && outDirIndex < compileArgs.length - 1) {
      compileArgs[outDirIndex + 1] = tmpDir;
    } else {
      compileArgs.push("--outDir", tmpDir);
    }

    compileArgs.push("--project", ".");
    compileArgs.push("--composite", "false");
    compileArgs.push("--incremental", "false");

    const compileCode = await compile(compileArgs, { cwd: config.cwd });
    if (compileCode) process.exit(compileCode);

    const files = await getModules(srcpath);

    const { inline = [], exclude = [] } = config.rdtsc || {};

    const inputs = files.map((f) => path.join(tmpDir, `${f}.d.ts`));

    const inlineModules: Record<string, string> = {};
    for (const extra of inline) {
      const manifest = require(extra + "/package.json");
      const typingsFile = manifest.typings || manifest.types;
      const filename = join(extra, typingsFile);
      const resolvedPath = require.resolve(filename);
      inputs.push(resolvedPath);
      inlineModules[extra] = resolvedPath;
    }

    const manifest = require(cwd + "/package.json");
    const dependencies = Object.keys(manifest.dependencies || {});

    const bundle = await rollup({
      input: inputs,
      plugins: [
        multiEntry(),
        dts({
          respectExternal: true,
          compilerOptions: {
            baseUrl: cwd,
            paths: config.get("paths") || {},
          },
        }),
      ],
      external: (id) => {
        if (inlineModules[id]) return false;
        if (exclude.includes(id)) return true;
        return dependencies.some(
          (dep) => id === dep || id.startsWith(`${dep}/`)
        );
      },
    });

    await bundle.write({
      file: destpath,
      format: "es",
    });

    await bundle.close();
  } finally {
    await rm(tmpDir, { recursive: true, force: true });
  }
}
