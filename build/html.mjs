import { outdir, getTime } from './constants.mjs';
import { cpSync, unlinkSync, readFileSync, writeFileSync } from 'fs';
import { watch } from 'chokidar';
import { update, log } from 'create-serve'; 

const staticDir = 'static';

function toDst(src) {
	return src.replace(staticDir, outdir);
}

function template(src, dst, outFiles) {
	let contents = readFileSync(src, 'utf8');

	const scripts = outFiles['js']
		.map(f => `<script type="text/javascript" src="${f}"></script>`)
		.join('\n');
	const injectJS = `
		<!-- Injected in html.mjs -->
		${scripts}`;
	contents = contents.replace('</body>', injectJS + '</body>');

	const css = outFiles['css']
		.map(f => `<link rel="stylesheet" type="text/css" href="${f}" />`)
		.join('\n');
	const injectCSS = `
		<!-- Injected in html.mjs -->
		${css}`;
	contents = contents.replace('</head>', injectCSS + '</head>');

	writeFileSync(dst, contents);
}

function isTemplated(src) {
	return src.endsWith('.html');
}

function filter(src, dst, outFiles) {
	if (!isTemplated(src)) {
		return true;
	}
	template(src, dst, outFiles);
	return false;
}

function updateDst(src, unlink, outFiles) {
	const dst = toDst(src);
	log(`[${getTime()}] Update ${dst}`);
	if (unlink) {
		unlinkSync(dst);
	} else {
		if (isTemplated(src)) {
			template(src, dst, outFiles);
		} else {
			cpSync(src, dst);
		}
	}
	update();
}

export function htmlSync(outFiles, isWatch) {
	cpSync(staticDir, outdir, {
		recursive: true,
		filter: (src, dst) => filter(src, dst, outFiles)
	});

	if (isWatch) {
		const watcher = watch(staticDir, { ignoreInitial: true, });

		watcher.on('add',    path => updateDst(path, false, outFiles));
		watcher.on('change', path => updateDst(path, false, outFiles));
		watcher.on('unlink', path => updateDst(path, true), outFiles);
	}
}
