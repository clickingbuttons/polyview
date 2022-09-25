import { build } from './esbuild.mjs';
import { htmlSync } from './html.mjs';
import { outdir, isWatch } from './constants.mjs';
import { start, update } from 'create-serve'; 

if (isWatch) {
	start({
		port: 7000,
    root: outdir,
    live: true
	});
}
build(isWatch)
	.then(res => res.metafile)
	.then(metafile => {
		const outJS = Object.keys(metafile.outputs)
			.filter(k => k.endsWith('.js'))
			.map(k => k.replace(outdir + '/', ''));
		htmlSync(outJS, isWatch);
		update();
	});

