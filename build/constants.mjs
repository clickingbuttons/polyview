export function getTime() {
	const now = new Date();
	return `${now.getHours()}:${now.getMinutes()}:${now.getSeconds()}`;
}
export const outdir = 'dist';
export const isProd = process.env.NODE_ENV == 'production';
export const isWatch = process.argv.includes('--watch');
