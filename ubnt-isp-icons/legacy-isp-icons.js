(function () {
  'use strict';

  const DEBUG = false;

  const ICONS = {
    xtrim: '/custom-icons/x-trim.svg',
    megafon: '/custom-icons/megafon.svg'
  };

  const INTERNET_ICON_MARKERS = [
    'Internet3DDark.svg',
    'Internet3DLight.svg',
    'Internet3D',
    'internet.svg'
  ];

  function log(...args) {
    if (DEBUG) {
      console.log('[UniFi ISP Icons]', ...args);
    }
  }

  function isInternetImg(img) {
    const src = img.getAttribute('src') || '';
    return INTERNET_ICON_MARKERS.some(marker => src.includes(marker));
  }

  function findLikelyContainer(element) {
    let node = element;

    for (let i = 0; i < 12 && node; i++) {
      const text = node.innerText || node.textContent || '';

      if (
        text.includes('MegaFon') ||
        text.includes('X-Trim') ||
        text.includes('Порт 9') ||
        text.includes('Порт 10') ||
        text.includes('Port 9') ||
        text.includes('Port 10') ||
        text.includes('31213') ||
        text.includes('44484')
      ) {
        return node;
      }

      node = node.parentElement;
    }

    return element.parentElement;
  }

  function getTextAround(element) {
    let node = element;
    let result = '';

    for (let i = 0; i < 10 && node; i++) {
      const text = node.innerText || node.textContent || '';

      if (text && text.length > result.length && text.length < 3000) {
        result = text;
      }

      node = node.parentElement;
    }

    return result;
  }

  function chooseIcon(text) {
    if (!text) {
      return null;
    }

    if (
      text.includes('MegaFon') ||
      text.includes('31213') ||
      text.includes('darkMegaFon')
    ) {
      return ICONS.megafon;
    }

    if (
      text.includes('X-Trim') ||
      text.includes('44484') ||
      text.includes('darkX-Trim')
    ) {
      return ICONS.xtrim;
    }

    if (
      text.includes('Порт 10') ||
      text.includes('Port 10')
    ) {
      return ICONS.megafon;
    }

    if (
      text.includes('Порт 9') ||
      text.includes('Port 9')
    ) {
      return ICONS.xtrim;
    }

    return null;
  }

  function replaceImg(img, icon) {
    if (!icon) {
      return;
    }

    if (img.dataset.customIspIcon === icon) {
      return;
    }

    img.dataset.originalSrc = img.dataset.originalSrc || img.src;
    img.dataset.customIspIcon = icon;

    img.src = icon;
    img.style.objectFit = 'contain';
    img.style.borderRadius = '10px';

    log('Replaced img icon:', icon, img);
  }

  function replaceBackground(element, icon) {
    if (!icon) {
      return;
    }

    const style = element.getAttribute('style') || '';

    if (!INTERNET_ICON_MARKERS.some(marker => style.includes(marker))) {
      return;
    }

    if (element.dataset.customIspIcon === icon) {
      return;
    }

    element.dataset.customIspIcon = icon;
    element.style.backgroundImage = 'url("' + icon + '")';
    element.style.backgroundSize = 'contain';
    element.style.backgroundRepeat = 'no-repeat';
    element.style.backgroundPosition = 'center';

    log('Replaced bg icon:', icon, element);
  }

  function scan() {
    const imgs = Array.from(document.querySelectorAll('img')).filter(isInternetImg);

    imgs.forEach((img, index) => {
      const container = findLikelyContainer(img);
      const text = getTextAround(container || img);
      let icon = chooseIcon(text);

      // Запасной режим: если текста рядом нет, назначаем по порядку.
      // Обычно первая Internet-иконка = WAN1/порт 9, вторая = WAN2/порт 10.
      if (!icon) {
        if (index === 0) {
          icon = ICONS.xtrim;
        }

        if (index === 1) {
          icon = ICONS.megafon;
        }
      }

      replaceImg(img, icon);
    });

    const bgElements = Array.from(
      document.querySelectorAll('[style*="Internet3D"], [style*="internet.svg"]')
    );

    bgElements.forEach((element, index) => {
      const container = findLikelyContainer(element);
      const text = getTextAround(container || element);
      let icon = chooseIcon(text);

      if (!icon) {
        if (index === 0) {
          icon = ICONS.xtrim;
        }

        if (index === 1) {
          icon = ICONS.megafon;
        }
      }

      replaceBackground(element, icon);
    });
  }

  let timer = null;

  function scheduleScan() {
    clearTimeout(timer);
    timer = setTimeout(scan, 300);
  }

  scan();

  const observer = new MutationObserver(scheduleScan);

  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['src', 'style', 'class']
  });

  window.addEventListener('load', scan);
  window.addEventListener('hashchange', scan);
  window.addEventListener('popstate', scan);
})();
