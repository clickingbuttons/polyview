import './split.css';

export function Splitter() {
	return (
		<div class="splitter" />
	);
}

export function SplitItem({ children }) {
	return (
		<div class="splitItem">
			{children}
		</div>
	);
}

export function Split({ children }) {
	
	return (
		<div class="split">
			{children}
		</div>
	);
}
