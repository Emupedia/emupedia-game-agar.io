importScripts('tf.min.js');
importScripts('nsfwjs.min.js');

onmessage = e => {
	fetch(e.data).then(res => res.blob()).then(async (res) => {
		const bitmap = await createImageBitmap(res);
		const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
		const context = canvas.getContext('2d');
		context.drawImage(bitmap, 0, 0);
		const img = context.getImageData(0, 0, bitmap.width, bitmap.height);

		// noinspection JSUnresolvedReference
		tf.setBackend('cpu');
		// noinspection JSUnresolvedReference
		tf.enableProdMode();

		let v2 = false
		let v3 = false

		// noinspection JSUnresolvedReference
		const model_v3 = await nsfwjs.load('../models/inception_v3/model.json', { size: 299 });
		// noinspection JSUnresolvedReference
		const prodictions_v3 = await model_v3.classify(img, 1);

		if (prodictions_v3[0] && prodictions_v3[0].className) {
			v3 = prodictions_v3[0].className === 'Neutral' || prodictions_v3[0].className === 'Drawing';
		}

		// noinspection JSUnresolvedReference
		const model_v2 = await nsfwjs.load('../models/mobilenet_v2/model.json', { type: 'graph' });
		// noinspection JSUnresolvedReference
		const prodictions_v2 = await model_v2.classify(img, 1);

		if (prodictions_v2[0] && prodictions_v2[0].className) {
			v2 = prodictions_v2[0].className === 'Neutral' || prodictions_v2[0].className === 'Drawing';
		}

		if (v2 === true && v3 === true) {
			postMessage(true);
		} else {
			postMessage(false);
		}
	});
}