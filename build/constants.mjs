export function getTime() {
	const now = new Date();
	const hours = String(now.getHours()).padStart(2, '0');
	const minutes = String(now.getMinutes()).padStart(2, '0');
	const seconds = String(now.getSeconds()).padStart(2, '0'); 
	return `${hours}:${minutes}:${seconds}`;
}
export const outdir = 'dist';
export const isProd = process.env.NODE_ENV == 'production';
export const isWatch = process.argv.includes('--watch');
