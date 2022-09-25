import { outdir, getTime } from './constants.mjs';
import { cpSync, unlinkSync, readFileSync, writeFileSync } from 'fs';
import { watch } from 'chokidar';
import { update, log } from 'create-serve'; 

const staticDir = 'static';

function toDst(src) {
	return src.replace(staticDir, outdir);
}

function template(src, dst, outJS) {
	let contents = readFileSync(src, 'utf8');
	const scripts = outJS
		.map(f => `<script type="text/javascript" src="${f}"></script>`)
		.join('\n');
	const includes = `
		<!-- Injected in html.mjs -->
		${scripts}`;
	contents = contents.replace('</body>', includes + '</body>');
	writeFileSync(dst, contents);
}

function filter(src, dst, outJS) {
	if (!src.endsWith('.html') || src.includes("tradingview")) {
		return true;
	}
	template(src, dst, outJS);
	return false;
}

function updateDst(src, unlink, outJS) {
	const dst = toDst(src);
	log(`[${getTime()}] Update ${dst}`);
	if (unlink) {
		unlinkSync(dst);
	} else {
		if (src.endsWith('.html')) {
			template(src, dst, outJS);
		} else {
			cpSync(src, dst);
		}
	}
	update();
}

export function htmlSync(outJS, isWatch) {
	cpSync(staticDir, outdir, {
		recursive: true,
		filter: (src, dst) => filter(src, dst, outJS)
	});

	if (isWatch) {
		const watcher = watch(staticDir, { ignoreInitial: true, });

		watcher.on('add',    path => updateDst(path, false, outJS));
		watcher.on('change', path => updateDst(path, false, outJS));
		watcher.on('unlink', path => updateDst(path, true), outJS);
	}
}
