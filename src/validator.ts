export class Validator {
	private el: HTMLElement;
	private toggleEl: HTMLDivElement;

	/**
	 * @param  {Element} el
	 */
	constructor(el: HTMLElement) {
		this.el = el;
		this.toggleEl = document.createElement('div');
		this.toggleEl.classList.add('report-toggle-wrap', 'hidden');
		this.el.appendChild(this.toggleEl);
	}
}
