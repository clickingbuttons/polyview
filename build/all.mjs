import { build } from './esbuild.mjs';
import { htmlSync } from './html.mjs';
import { outdir, isWatch } from './constants.mjs';
import { start } from 'create-serve'; 

if (isWatch) {
	start({
		port: 7000,
    root: outdir,
    live: true
	});
	htmlSync(isWatch);
	build(isWatch);
}

