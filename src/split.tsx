import { FunctionComponent } from 'preact';
import './split.css';

export function Splitter() {
	return (
		<div class="splitter" />
	);
}

export const SplitItem: FunctionComponent = ({ children }) => {
	return (
		<div class="splitItem">
			{children}
		</div>
	);
}

export const Split: FunctionComponent = ({ children }) => {
	return (
		<div class="split">
			{children}
		</div>
	);
}
