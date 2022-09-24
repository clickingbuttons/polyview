import { outdir, getTime } from './constants.mjs';
import { cpSync, unlinkSync } from 'fs';
import { watch } from 'chokidar';
import { update, log } from 'create-serve'; 

const staticDir = 'static';

function toDst(src) {
	return src.replace(staticDir, outdir);
}

function updateDst(src, unlink) {
	const dst = toDst(src);
	log(`[${getTime()}] Update ${dst}`);
	if (unlink) {
		unlinkSync(dst);
	} else {
		cpSync(src, dst);
	}
	update();
}

export function htmlSync(isWatch) {
	cpSync(staticDir, outdir, { recursive: true });
	if (isWatch) {
		const watcher = watch(staticDir, { ignoreInitial: true, });

		watcher.on('add',    path => updateDst(path, false));
		watcher.on('change', path => updateDst(path, false));
		watcher.on('unlink', path => updateDst(path, true));
	}
}
