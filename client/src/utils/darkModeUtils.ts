import { useState, useEffect } from "react";

// 立即应用主题的函数，在页面加载时调用
export function initializeTheme() {
  const mode = localStorage.getItem("theme");
  const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");

  function applyMode(targetMode: 'light' | 'dark') {
    document.documentElement.setAttribute('data-color-mode', targetMode);
    if (targetMode === 'dark') {
      document.documentElement.classList.add('dark');
      document.documentElement.classList.remove('light');
    } else {
      document.documentElement.classList.add('light');
      document.documentElement.classList.remove('dark');
    }
  }

  if (mode === "dark") {
    applyMode("dark");
  } else if (mode === "light") {
    applyMode("light");
  } else {
    // mode === null || mode === "system"
    if (mediaQuery.matches) {
      applyMode("dark");
    } else {
      applyMode("light");
    }
  }
}

export function listenSystemMode() {
  const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");

  function applyMode(targetMode: 'light' | 'dark') {
    document.documentElement.setAttribute('data-color-mode', targetMode);
    if (targetMode === 'dark') {
      document.documentElement.classList.add('dark');
      document.documentElement.classList.remove('light');
    } else {
      document.documentElement.classList.add('light');
      document.documentElement.classList.remove('dark');
    }
    window.dispatchEvent(new Event("colorSchemeChange"));
  }

  function darkModeHandler() {
    const mode = localStorage.getItem("theme");

    if (mode === "dark") {
      applyMode("dark");
    } else if (mode === "light") {
      applyMode("light");
    } else {
      // mode === null || mode === "system"
      if (mediaQuery.matches) {
        applyMode("dark");
      } else {
        applyMode("light");
      }
    }
  }

  // 判断当前模式
  darkModeHandler();
  // 监听模式变化
  mediaQuery.addEventListener("change", darkModeHandler);
}

export function getCurrentColorMode(): "light" | "dark" {
  return (
    (document.documentElement.getAttribute("data-color-mode") as
      | "light"
      | "dark") || "light"
  );
}



export function useColorMode() {
  const [colorMode, setColorMode] = useState<"light" | "dark">(
    getCurrentColorMode()
  );

  useEffect(() => {
    const updateColorMode = () => {
      setColorMode(getCurrentColorMode());
    };

    // 初始设置
    updateColorMode();

    // 监听颜色模式变化事件
    window.addEventListener("colorSchemeChange", updateColorMode);

    // 清理函数
    return () => {
      window.removeEventListener("colorSchemeChange", updateColorMode);
    };
  }, []);

  return colorMode;
}
