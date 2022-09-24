import esbuild from 'esbuild';
import { isProd, outdir, getTime } from './constants.mjs';
import { update, log } from 'create-serve'; 

export async function build(isWatch) {
	return esbuild
		.build({
			bundle: true,
			entryPoints: ['src/entry.ts'],
			define: {
				'IS_PROD': JSON.stringify(isProd),
			},
			sourcemap: !isProd,
			minify: isProd,
			outdir: outdir,
			metafile: true,
			watch: isWatch && {
				onRebuild(err, res) {
					update();
					if (!err) {
						const nInputs = Object.keys(res.metafile.inputs).length;
						const nOutputs = Object.keys(res.metafile.outputs).length;
						log(`[${getTime()}] Sucessfully bundled ${nInputs} files into ${nOutputs} outputs`);
					}
				}
			}
		})
		.catch(() => process.exit(1));
}

