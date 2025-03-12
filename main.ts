import * as fs from 'fs';
import * as path from 'path';
import { transformWxTsToVue3Setup } from './dist/covertor.js'
import { convertWXMLToVueTemplate } from './wxml2template';
import { promisify } from 'util';
import { error } from 'console';

const readdir = promisify(fs.readdir);
const stat = promisify(fs.stat);
const readFile = promisify(fs.readFile);
const writeFile = promisify(fs.writeFile);
const mkdir = promisify(fs.mkdir);

interface Converters {
     convertTS: (content: string) => { outputVueCode: string, otherString: string };
     convertWXML: (content: string) => string;
}
const convertSnakeToCamel = (snakeStr: string): string => {
     return snakeStr
          .split('-')
          .map((word, index) => {
               // 将第一个字母大写，其余小写
               if (index === 0) {
                    return word.charAt(0).toLowerCase() + word.slice(1);
               }
               return word.charAt(0).toUpperCase() + word.slice(1);
          })
          .join('');
};

const convertToVueComponentName = (snakeStr: string): string => {
     const camelCaseStr = convertSnakeToCamel(snakeStr);
     // 确保首字母大写，以符合 Vue 组件名的惯例
     return camelCaseStr.charAt(0).toUpperCase() + camelCaseStr.slice(1);
};
async function convertMiniProgram(
     srcDir: string,
     destDir: string,
     converters: Converters
): Promise<void> {
     async function processDirectory(currentDir: string): Promise<void> {
          try {
               const entries = await readdir(currentDir, { withFileTypes: true });

               // 先处理当前目录
               await processFolder(currentDir);

               // 递归处理子目录
               for (const entry of entries) {
                    const fullPath = path.join(currentDir, entry.name);
                    if (entry.isDirectory()) {
                         await processDirectory(fullPath);
                    }
               }
          } catch (error) {
               throw new Error(`处理目录 ${currentDir} 失败: ${error.message}`);
          }
     }

     async function processFolder(folderPath: string): Promise<void> {
          try {
               const relativePath = path.relative(srcDir, folderPath);

               // 修改后的目录过滤逻辑
               const allowedRoots = [
                    'components',
                    'pages',
                    'me',          // 新增分包目录
                    'operate-device' // 新增分包目录
               ];

               // 使用更精确的路径匹配
               const shouldConvert = allowedRoots.some(root => {
                    // 匹配根目录自身或子目录
                    const rootPattern = new RegExp(`^${root}(\\${path.sep}|$)`);
                    return rootPattern.test(relativePath);
               });

               if (!shouldConvert) {
                    console.log(`跳过非转换目录: ${relativePath}`);
                    return;
               }
               // 读取目录文件
               const files = await readdir(folderPath);

               // 文件类型计数器
               let tsCount = 0, wxmlCount = 0, wxssCount = 0;
               let tsContent = '', wxmlContent = '', wxssContent = '', otherString = '';

               for (const file of files) {
                    const filePath = path.join(folderPath, file);
                    const ext = path.extname(file);

                    try {
                         switch (ext) {
                              case '.ts':
                                   tsCount++;
                                   if (tsCount > 1) return
                                   const output = converters.convertTS(await readFile(filePath, 'utf8'));
                                   tsContent = output.outputVueCode
                                   otherString = output.otherString
                                   break;
                              case '.wxml':
                                   wxmlCount++;
                                   if (wxmlCount > 1) return
                                   wxmlContent = converters.convertWXML(await readFile(filePath, 'utf8'));
                                   break;
                              case '.wxss':
                                   wxssCount++;
                                   if (wxssCount > 1) return
                                   wxssContent = await readFile(filePath, 'utf8');
                                   break;
                         }
                    } catch (error) {
                         throw new Error(`处理文件 ${file} 失败: ${error.message}`);
                    }
               }

               // 验证必要文件
               if (!tsCount) return;
               if (!wxmlCount) return;
               // 生成Vue文件内容
               tsContent = tsContent.trim() ? `<script lang="ts" setup>\n${tsContent}\n</script>\n` : '';
               wxmlContent = wxmlContent.trim() ? `<template>\n${wxmlContent}\n</template>\n` : '';
               wxssContent = wxssContent.trim() ? `<style>\n${wxssContent}\n</style>` : '';

               const vueContent = `${tsContent}${wxmlContent}${wxssContent}`;
               // 生成目标路径
               const outputPath = path.join(destDir, relativePath);
               // 获取文件夹的父级目录路径
               const parentDir = path.dirname(outputPath);
               await mkdir(parentDir, { recursive: true });


               // console.log(path.join(parentDir, `${convertToVueComponentName(path.basename(folderPath))}.vue`));
               await writeFile(
                    path.join(parentDir, `${path.basename(folderPath)}.vue`),
                    vueContent,
                    'utf8'
               );
               // console.log(`otherString: ${otherString}:${typeof otherString}`, path.join(destDir, 'src/content_util', `${path.basename(folderPath)}.ts`));
               // throw new Error(`哈哈哈哈`);
               if (otherString && otherString.length > 0) {

                    await writeFile(
                         path.join(destDir, 'content_util', `${path.basename(folderPath)}.ts`),
                         otherString,
                         'utf8'
                    );
               }

          } catch (error) {
               throw new Error(`处理目录 ${folderPath} 失败: ${error.message}`);
          }
     }
     await mkdir(path.join(destDir, 'content_util'), { recursive: true });
     await processDirectory(srcDir);
}

// 使用示例
convertMiniProgram('C:/Users/19486/Desktop/小程序项目2025/shicaoshou/miniprogram', 'C:/Users/19486/Desktop/小程序项目2025/shicaoshou_covert/miniprogram', {
     convertTS: transformWxTsToVue3Setup,
     convertWXML: convertWXMLToVueTemplate,
})
     .then(() => console.log('转换完成'))
     .catch((error) => {
          console.error('转换失败:');
          console.error(`[${error.stack.split('\n')[0]}]`);
          process.exit(1);
     });
