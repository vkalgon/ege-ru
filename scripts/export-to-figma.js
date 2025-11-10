/**
 * Скрипт для экспорта CSS переменных в формат Figma Tokens
 * Использование: node scripts/export-to-figma.js
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Читаем CSS файл
const cssPath = path.join(__dirname, '../public/styles.css');
const cssContent = fs.readFileSync(cssPath, 'utf-8');

// Парсим CSS переменные для обеих тем
function parseCSSVariables(css) {
  const darkTheme = {};
  const lightTheme = {};
  
  // Парсим :root (dark theme)
  const rootMatch = css.match(/:root\s*\{([^}]+)\}/);
  if (rootMatch) {
    const rootContent = rootMatch[1];
    const varRegex = /--([\w-]+):\s*([^;]+);/g;
    let match;
    while ((match = varRegex.exec(rootContent)) !== null) {
      const [, name, value] = match;
      darkTheme[name.trim()] = value.trim();
    }
  }
  
  // Парсим [data-theme="light"]
  const lightMatch = css.match(/\[data-theme="light"\]\s*\{([^}]+)\}/);
  if (lightMatch) {
    const lightContent = lightMatch[1];
    const varRegex = /--([\w-]+):\s*([^;]+);/g;
    let match;
    while ((match = varRegex.exec(lightContent)) !== null) {
      const [, name, value] = match;
      lightTheme[name.trim()] = value.trim();
    }
  }
  
  return { dark: darkTheme, light: lightTheme };
}

// Конвертируем CSS значение в формат Figma
function convertToFigmaValue(value) {
  // Убираем var() ссылки
  if (value.startsWith('var(')) {
    return value; // Оставляем как есть, Figma может обработать
  }
  
  // Обрабатываем цвета
  if (value.startsWith('#')) {
    return value;
  }
  
  if (value.startsWith('rgba(') || value.startsWith('rgb(')) {
    return value;
  }
  
  // Сложные значения (blur, shadows, gradients) оставляем как строки
  if (value.includes('blur(') || value.includes('shadow') || value.includes('rgba') || value.includes('px') && value.includes(' ')) {
    return value; // Сложные значения с несколькими частями
  }
  
  // Простые размеры (только число + px, без других символов)
  const simplePxMatch = value.match(/^(\d+(?:\.\d+)?)px$/);
  if (simplePxMatch) {
    return parseFloat(simplePxMatch[1]);
  }
  
  // Числовые значения без единиц
  const numberMatch = value.match(/^(\d+(?:\.\d+)?)$/);
  if (numberMatch) {
    return parseFloat(numberMatch[1]);
  }
  
  return value;
}


// Основная функция
function exportToFigma() {
  const { dark: darkVars, light: lightVars } = parseCSSVariables(cssContent);
  
  // Создаем структуру в формате Tokens Studio / Design Tokens
  // Плагин ожидает плоскую структуру с типами токенов
  const figmaTokens = {};
  
  // Функция для обработки цветов
  function processColors(themeVars, themeName) {
    const themePrefix = themeName === 'dark' ? 'dark' : 'light';
    
    for (const [name, value] of Object.entries(themeVars)) {
      const figmaValue = convertToFigmaValue(value);
      
      if (name.includes('bg-') || name.includes('text-') || name.includes('neon-') || name.includes('glass-')) {
        // Создаем вложенную структуру для цветов
        if (!figmaTokens.color) {
          figmaTokens.color = {};
        }
        if (!figmaTokens.color[themePrefix]) {
          figmaTokens.color[themePrefix] = {};
        }
        figmaTokens.color[themePrefix][name] = {
          type: 'color',
          value: figmaValue
        };
      }
    }
  }
  
  // Функция для обработки spacing
  function processSpacing(themeVars) {
    for (const [name, value] of Object.entries(themeVars)) {
      if (name.includes('space-') || name.includes('radius-')) {
        const figmaValue = convertToFigmaValue(value);
        if (!figmaTokens.spacing) {
          figmaTokens.spacing = {};
        }
        figmaTokens.spacing[name] = {
          type: 'dimension',
          value: typeof figmaValue === 'number' ? `${figmaValue}px` : figmaValue
        };
      }
    }
  }
  
  // Функция для обработки типографики
  function processTypography(themeVars) {
    const typographyMap = {};
    
    // Собираем связанные значения типографики
    for (const [name, value] of Object.entries(themeVars)) {
      if (name.includes('h2')) {
        if (!typographyMap.h2) typographyMap.h2 = {};
        if (name === 'h2') typographyMap.h2.fontSize = convertToFigmaValue(value);
        if (name === 'h2-lh') typographyMap.h2.lineHeight = convertToFigmaValue(value);
        if (name === 'h2-fw') typographyMap.h2.fontWeight = convertToFigmaValue(value);
      } else if (name.includes('body')) {
        if (!typographyMap.body) typographyMap.body = {};
        if (name === 'body') typographyMap.body.fontSize = convertToFigmaValue(value);
        if (name === 'body-lh') typographyMap.body.lineHeight = convertToFigmaValue(value);
      }
    }
    
    // Сохраняем типографику
    if (!figmaTokens.typography) {
      figmaTokens.typography = {};
    }
    
    for (const [name, props] of Object.entries(typographyMap)) {
      figmaTokens.typography[name] = {
        type: 'typography',
        value: {
          fontFamily: 'Inter',
          fontSize: typeof props.fontSize === 'number' ? `${props.fontSize}px` : props.fontSize,
          lineHeight: typeof props.lineHeight === 'number' ? `${props.lineHeight}px` : props.lineHeight,
          fontWeight: props.fontWeight || 400
        }
      };
    }
  }
  
  // Функция для обработки эффектов
  function processEffects(themeVars) {
    for (const [name, value] of Object.entries(themeVars)) {
      if (name.includes('shadow') || name.includes('glow')) {
        const figmaValue = convertToFigmaValue(value);
        if (!figmaTokens.shadow) {
          figmaTokens.shadow = {};
        }
        figmaTokens.shadow[name] = {
          type: 'boxShadow',
          value: figmaValue
        };
      }
    }
  }
  
  // Обрабатываем обе темы
  processColors(darkVars, 'dark');
  processColors(lightVars, 'light');
  processSpacing(darkVars); // Spacing одинаковый для обеих тем
  processTypography(darkVars); // Typography одинаковая для обеих тем
  processEffects(darkVars); // Effects одинаковые для обеих тем
  
  // Сохраняем в файл
  const outputPath = path.join(__dirname, '../figma-tokens.json');
  const jsonContent = JSON.stringify(figmaTokens, null, 2);
  fs.writeFileSync(outputPath, jsonContent, 'utf-8');
  
  // Отладочная информация
  console.log('✅ Дизайн-токены экспортированы в figma-tokens.json');
  console.log(`   - Структура: ${Object.keys(figmaTokens).join(', ')}`);
  console.log(`   - Темная тема: ${Object.keys(darkVars).length} переменных`);
  console.log(`   - Светлая тема: ${Object.keys(lightVars).length} переменных`);
  if (figmaTokens.color) {
    console.log(`   - Цвета (dark): ${Object.keys(figmaTokens.color.dark || {}).length}`);
    console.log(`   - Цвета (light): ${Object.keys(figmaTokens.color.light || {}).length}`);
  }
  console.log('📦 Используйте плагин "Figma Tokens" для импорта в Figma');
  console.log('📖 См. FIGMA_IMPORT_GUIDE.md для подробных инструкций');
  console.log('');
  console.log('💡 Если плагин не видит токены, попробуйте:');
  console.log('   1. Убедитесь, что используете плагин "Tokens Studio for Figma"');
  console.log('   2. В плагине выберите "Import tokens" → "JSON"');
  console.log('   3. Или используйте альтернативный формат (см. figma-tokens-alt.json)');
}

exportToFigma();

