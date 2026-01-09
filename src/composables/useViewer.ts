import { ref } from 'vue';
import { Viewer } from '../pages/viewer.ts';

export function useViewer(options) {
	const viewer = ref(null);

	const createViewer = (el) => {
		viewer.value = new Viewer(el, options);
		return viewer.value;
	};

	return {
		viewer,
		createViewer,
	};
}
