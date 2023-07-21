import { sep } from 'path'
import htmlPlugin from 'esbuild-plugin-template'
import copyPlugin from 'esbuild-copy-static-files'

const outdir = 'dist';
const routes = ['index'];

function htmlConfig() {
	return routes.map(r => ({
		filename: `${r}.html`,
		template(result, initialOptions) {
			const outputs = (Object.keys(result?.metafile?.outputs ?? []));
			const stripBase = f => f.replace(initialOptions.outdir + sep, '');
			const stylesheets = outputs.filter(f => f.endsWith('.css')).map(stripBase);
			const scripts = outputs.filter(f => f.endsWith('.js')).map(stripBase);

			return `<!DOCTYPE html>
<html lang="en">
	<head>
		<meta charset="utf-8">
		<title>Polyview</title>
		<!-- Fix for iOS Safari zooming bug -->
		<meta name="viewport" content="width=device-width,initial-scale=1.0,maximum-scale=1.0,minimum-scale=1.0">
		<!-- Don't let 3rd party deps phone home -->
		<meta http-equiv="Content-Security-Policy" content="default-src 'self' api.polygon.io localhost:8123 wss://socket.polygon.io 'unsafe-inline';" />
		<!-- Make default styles the same across browsers (mostly) -->
		<link rel="stylesheet" type="text/css" href="minireset.css" />
		${stylesheets.map(f => `<link rel="stylesheet" href="${f}"></script>`).join('\n')}
	</head>
	<body class="dark">
		<div id="root"></div>
		${scripts.map(f => `<script src="${f}"></script>`).join('\n')}
	</body>
</html>`
		}
}))
};

export const esbuildConfig = ({ isProd }) => ({
	entryPoints: ['src/entry.tsx'],
	entryNames: `[dir]/[name]${isProd ? '.[hash]' : ''}`,
	metafile: true,
	bundle: true,
	sourcemap: isProd ? 'external' : 'inline',
	minify: isProd,
	outdir,
	jsxFactory: "h",
	jsxFragment: "Fragment",
	jsx: 'automatic',
	jsxImportSource: 'preact',
	plugins: [
		htmlPlugin(htmlConfig(isProd)),
		copyPlugin({
			src: 'static',
			dest: outdir,
		}),
	]
})

