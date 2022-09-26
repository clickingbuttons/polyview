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
		const outFiles = Object.keys(metafile.outputs)
			.reduce((acc, cur) => {
				const ext = cur.split('.').pop(); 
				acc[ext] = acc[ext] || [];
				acc[ext].push(cur.replace(outdir + '/', ''));

				return acc;
			}, {});
		htmlSync(outFiles, isWatch);
		update();
	});

