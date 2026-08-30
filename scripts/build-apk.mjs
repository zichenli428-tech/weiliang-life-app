#!/usr/bin/env node
/**
 * 一键打包 release APK
 * 流程：npm run build → npx cap sync android → gradlew assembleRelease
 * 自动解析 JAVA_HOME（优先环境变量，否则用项目内 .jdk21）和 ANDROID_HOME
 * 签名配置读取自 android/keystore.properties（见 android/app/build.gradle）
 */
import { spawnSync } from 'node:child_process'
import { existsSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { platform } from 'node:os'

const isWin = platform() === 'win32'
const projectRoot = process.cwd()

/** 解析 JAVA_HOME：优先环境变量，否则用项目内 .jdk21 */
function resolveJavaHome() {
  if (process.env.JAVA_HOME && existsSync(process.env.JAVA_HOME)) return process.env.JAVA_HOME
  const jdkDir = join(projectRoot, '.jdk21')
  if (existsSync(jdkDir)) {
    const sub = readdirSync(jdkDir).find((d) => /^jdk-/i.test(d))
    if (sub) return join(jdkDir, sub)
  }
  console.error('❌ 未找到 JDK：请设置 JAVA_HOME 环境变量，或在项目 .jdk21/ 放置 JDK 21')
  process.exit(1)
}

/** 解析 ANDROID_HOME：优先环境变量，否则检测系统默认位置 */
function resolveAndroidHome() {
  if (process.env.ANDROID_HOME && existsSync(process.env.ANDROID_HOME)) return process.env.ANDROID_HOME
  const candidates = isWin
    ? [join(process.env.LOCALAPPDATA || '', 'Android', 'Sdk')]
    : [join(process.env.HOME || '', 'Library', 'Android', 'sdk')]
  for (const c of candidates) if (existsSync(c)) return c
  console.error('❌ 未找到 Android SDK：请设置 ANDROID_HOME 环境变量')
  process.exit(1)
}

process.env.JAVA_HOME = resolveJavaHome()
process.env.ANDROID_HOME = resolveAndroidHome()

console.log(`▶ JAVA_HOME    = ${process.env.JAVA_HOME}`)
console.log(`▶ ANDROID_HOME = ${process.env.ANDROID_HOME}`)

function run(cmd, args, opts = {}) {
  const line = `${cmd} ${args.join(' ')}`
  console.log(`\n$ ${line}`)
  // Windows 下需 shell 解析 .cmd/.bat（npm.cmd、npx.cmd、gradlew.bat）；传单字符串避免 DEP0190
  const r = isWin
    ? spawnSync(line, { stdio: 'inherit', shell: true, ...opts })
    : spawnSync(cmd, args, { stdio: 'inherit', ...opts })
  if (r.status !== 0) {
    console.error(`\n❌ 命令失败 (exit ${r.status}): ${cmd} ${args.join(' ')}`)
    process.exit(r.status ?? 1)
  }
}

// 1. 构建最新 web 资源
run('npm', ['run', 'build'])

// 2. 同步到 Android 工程
run('npx', ['cap', 'sync', 'android'])

// 3. Gradle 打包 release（已配置 keystore.properties 自动签名）
run(isWin ? 'gradlew.bat' : './gradlew', ['assembleRelease'], {
  cwd: join(projectRoot, 'android')
})

// 4. 输出产物路径
const apkPath = join(
  projectRoot,
  'android',
  'app',
  'build',
  'outputs',
  'apk',
  'release',
  'app-release.apk'
)
console.log(`\n✅ 打包成功！release APK：\n   ${apkPath}`)
console.log('   验证签名：apksigner verify --verbose <apk>')
