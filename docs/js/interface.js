$(function() {
	var location = ~window.location.hostname.indexOf('emupedia.net') ? 'emupedia.net' : (~window.location.hostname.indexOf('emupedia.org') ? 'emupedia.org' : (~window.location.hostname.indexOf('emupedia.games') ? 'emupedia.games' : (~window.location.hostname.indexOf('emuos.net') ? 'emuos.net' : (~window.location.hostname.indexOf('emuos.org') ? 'emuos.org' : (~window.location.hostname.indexOf('emuos.games') ? 'emuos.games' : 'emupedia.net')))));
	var FP = FingerprintJS.load();
	var externallyFramed;
	var agarv1ident;
	var bannedIdent = [];
	var knownSkins = [];
	var interval;
	var $nick = $('#nick');
	var $skin = $('#skin');
	var $gallery = $('#gallery')

	try {
		externallyFramed = window.top.location.host !== window.location.host;
	} catch (e) {
		externallyFramed = true;
	}

	if (externallyFramed) {
		try {
			window.top.location = window.location;
		} catch (e) {}
	}

	function sanitizeSkin(str) {
		return str.replace(/[^a-zA-Z0-9_\- ]/gim, '').trim();
	}

	function sanitizeNick(str) {
		return str.replace(/[<>|]/gim, '').trim();
	}

	$.get('skinList.txt', function(data, status) {
		if (status === 'success') {
			var skins = data.split(',');
			if (skins.length === 0) return;
			knownSkins = skins;

			$('#gallery-btn').css('display', 'inline-block');

			$.get('fpBanList.txt').success(function(data) {
				var fp = data.split(',');

				for (var p of fp) bannedIdent.push(p);

				try {
					agarv1ident = localStorage.getItem('agarv1ident');
				} catch (e) {}

				FP.then(function (fp) { return fp.get() }).then(function(result) {
					localStorage.setItem('agarv1ident', result.visitorId);

					var ban = false;

					bannedIdent.forEach(function(val) {
						if (agarv1ident === val) {
							ban = true;
						}
					});

					if (ban) {
						$('#chat_textbox').hide();
						$('#overlays').hide();
						$('#connecting div').html('<h3 style="text-align: center">You are banned 😭</h3><hr class="top" /><p style="text-align: center">You are banned from the game because you broke the rules either spamming the chat or while uploading custom skins.</p><a class="text-center" style="display: block; color: red;" href="https://discord.gg/emupedia-510149138491506688" target="_blank">Join us on Discord!</a><h1 style="text-align: center;">Your unban code is<br /><br />' + btoa(agarv1ident).replace(/(.{10})/g, "$1<br />") + '</h1>');
						$('#connecting').show();
					} else {
						$('#overlays').show();

						/*grecaptcha.ready(function() {
							grecaptcha.execute('6LdxZMspAAAAAOVZOMGJQ_yJo2hBI9QAbShSr_F3', { action: 'connect' }).then(function(token) {
								connect('wss://agar.' + location + '/ws1/?token=' + token);
							});
						});*/

						connect('wss://agar.' + location + '/ws1/');

						clearInterval(interval);
						interval = setInterval(function() {
							FP.then(function (fp) { return fp.get() }).then(function (result) {
								localStorage.setItem('agarv1ident', result.visitorId);

								let ban = false;

								bannedIdent.forEach(function(val) {
									if (agarv1ident === val) {
										ban = true;
									}
								});

								if (ban) {
									$('#chat_textbox').hide();
									$('#overlays').hide();
									$('#connecting div').html('<h3 style="text-align: center">You are banned 😭</h3><hr class="top" /><p style="text-align: center">You are banned from the game because you broke the rules either spamming the chat or while uploading custom skins.</p><a class="text-center" style="display: block; color: red;" href="https://discord.gg/emupedia-510149138491506688" target="_blank">Join us on Discord!</a><h1 style="text-align: center;">Your unban code is<br /><br />' + btoa(agarv1ident).replace(/(.{10})/g, "$1<br />") + '</h1>');
									$('#connecting').show();
								}
							});
						}, 10000);
					}
				});
			}).error(function() {
				$('#overlays').show();

				/*grecaptcha.ready(function() {
					grecaptcha.execute('6LdxZMspAAAAAOVZOMGJQ_yJo2hBI9QAbShSr_F3', { action: 'connect' }).then(function (token) {
						connect('wss://agar.' + location + '/ws1/?token=' + token);
					});
				});*/

				connect('wss://agar.' + location + '/ws1/');
			});
		}
	}).error(function() {
		$('#overlays').show();

		/*grecaptcha.ready(function() {
			grecaptcha.execute('6LdxZMspAAAAAOVZOMGJQ_yJo2hBI9QAbShSr_F3', { action: 'connect' }).then(function(token) {
				connect('wss://agar.' + location + '/ws1/?token=' + token);
			});
		});*/

		connect('wss://agar.' + location + '/ws1/');
	});

	$('input').keypress(function(e) {
		if (e.which === '13') {
			if (!isSpectating) {
				setNick('<' + sanitizeSkin($skin.val()) + '|' + (agarv1ident ? agarv1ident : '') + '>' + sanitizeNick($nick.val()));
			}
		}
	});

	$('#gallery-btn').on('click', function(e) {
		e.preventDefault();

		var $gallerybody = $('#gallery-body');

		if ($gallerybody.html() === '') {
			var sortedSkins = knownSkins.sort();
			var c = '';

			for (var skin in sortedSkins) {
				if (sortedSkins[skin] !== '') {
					c += '<li class="skin" data-skin="' + sortedSkins[skin] + '">';
					c +=	'<img class="circular" loading="lazy" src="./skins/' + sortedSkins[skin] + '.png">';
					c +=	'<h4 class="skinName">' + sortedSkins[skin] + '</h4>';
					c += '</li>';
				}
			}

			$gallerybody.html('<ul id="skinsUL">' + c + '</ul>');

			$('li.skin').off('click').on('click', function() {
				var skin = $(this).data('skin');
				$skin.val(sanitizeSkin(skin));
				localStorage.setItem('agarv1skin', skin);
				$gallery.hide();
			});
		}

		$gallery.css('display', 'flex');

		return false;
	})

	$gallery.off('click').on('click', function(e) {
		if (e.target === $(this).get(0)) {
			$(this).hide();
		}
	});

	$('#settings-btn').off('click').on('click', function(e) {
		e.preventDefault();

		$('#settings').toggle();

		return false;
	});

	$('#play-btn').off('click').on('click', function(e) {
		e.preventDefault();

		var form = $('#form').get(0);

		if (form && typeof form['reportValidity'] === 'function' && form.reportValidity()) {
			setNick('<' + sanitizeSkin($skin.val()) + '|' + (agarv1ident ? agarv1ident : '') + '>' + sanitizeNick($nick.val()));
		}

		return false;
	});

	$('#spectate-btn').off('click').on('click', function(e) {
		e.preventDefault();

		spectate();

		return false;
	});

	$nick.off('input change blur').on('input change blur', function(e) {
		localStorage.setItem('agarv1nick', e.target.value);
	});

	$skin.off('input change blur').on('input change blur', function(e) {
		localStorage.setItem('agarv1skin', e.target.value);
	});

	$('#chat_textbox').off('paste').on('paste', function(e) {
		e.preventDefault();
		return false;
	});

	$nick.val(localStorage.getItem('agarv1nick') || '');
	$skin.val(localStorage.getItem('agarv1skin') || '');
});