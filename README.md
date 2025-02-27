# rdtsc

[![npm](https://img.shields.io/npm/v/rdtsc?style=flat-square)](https://www.npmjs.com/package/dtsc-rollup)
[![GitHub](https://img.shields.io/github/license/Hoshino-Yumetsuki/rdtsc?style=flat-square)](https://github.com/Hoshino-Yumetsuki/rdtsc/blob/main/LICENSE)

Generate bundled TypeScript declaration files with Rollup.

## Background

TypeScript has a [`outFile`](https://www.typescriptlang.org/tsconfig/#outFile) compiler option:

> If specified, all global (non-module) files will be concatenated into the single output file specified.
>
> If module is system or amd, all module files will also be concatenated into this file after all global content.
>
> Note: outFile cannot be used unless module is None, System, or AMD. **This option cannot be used to bundle CommonJS or ES6 modules.**

Supposing you have a project structure like this:

```
├── src
│   ├── index.ts
│   ├── foo.ts
│   └── bar.ts
├── package.json
└── tsconfig.json
```

After running `tsc --outDir lib`, the following file will be generated:

```ts
// lib/index.d.ts
declare module "foo" {
  export function someMethod(): void;
}
declare module "bar" {
  export function otherMethod(): void;
}
declare module "index" {
  export * from "foo";
  export * from "bar";
  export * from "baz";
}
```

However, what we really want is:

```ts
// lib/index.d.ts
export function someMethod(): void;
export function otherMethod(): void;
```

This is where dtsc comes in. It generates a single bundled declaration file which behaves like other bundling tools.

## Usage

rdtsc supports `outDir` option out of the box.

```jsonc
// tsconfig.json
{
  "compilerOptions": {
    "rootDir": "src",
    "outDir": "lib",
  },
  "include": [
    "src",
  ],
}
```

```jsonc
// package.json
{
  "typings": "lib/index.d.ts",
  "scripts": {
    "build": "rdtsc",
  },
}
```

```bash
npm run build
```

<!-- In most cases I would recommend using tsc directly. -->
