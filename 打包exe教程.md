# 打包 Windows .exe 教程（小白版）

只要按下面 4 步就能把这个应用打包成 Windows 安装包（.exe）。

---

## 准备工作（一次性，约 10 分钟）

### ① 装 Node.js（如果之前已经能运行 `npm run dev` 就跳过这步）

去 https://nodejs.org 下载 **LTS 版本**，一路下一步。

装完打开 PowerShell（开始菜单搜 `powershell` 回车），输入：

```powershell
node --version
```

看到 `v22.x.x` 就 OK。

### ② 装 Rust 编译器

打 .exe 需要 Rust，这是一次性的，以后不用再装。

1. 打开 https://www.rust-lang.org/zh-CN/tools/install
2. 点 **「下载 rustup-init.exe」**（页面正中那个大按钮）
3. 双击下载的 `rustup-init.exe`
4. 弹出黑框框后会问你：

   ```
   1) Proceed with standard installation (default - just press enter)
   2) Customize installation
   3) Cancel installation
   ```

   **直接按 `1` 或者 `回车`** 就行（用默认配置）

5. 等待大约 5-8 分钟（要下载约 500MB）

6. 看到 `Rust is installed now. Great!` 就装好了

7. **关闭所有 PowerShell / 命令行窗口**（让环境变量生效）

8. 重开一个 PowerShell，输入：

   ```powershell
   cargo --version
   ```

   看到 `cargo 1.x.x` 就 OK。

> 💡 如果显示 "不是内部或外部命令"，说明环境变量还没生效，重启电脑再试。

> 💡 Rust 自带 MSVC 链接器需要的工具，不需要额外装 Visual Studio。
> 如果第一次运行时它提示需要装 "Microsoft C++ Build Tools"，按它给的链接装就行。

---

## 开始打包（每次需要重新打包时）

### ③ 双击运行 `打包exe.bat`

进入 `simple-ai` 文件夹，找到 **`打包exe.bat`**，双击它。

它会自动：

1. 检查 Node.js 和 Rust 是否就绪
2. 安装项目依赖（第一次需要 1-3 分钟）
3. 调用 Tauri 打包
4. 打包完自动打开输出目录

**第一次打包**会下载 Rust 编译需要的库，大约要 **10-30 分钟**。后面再打包就快了。

打包过程中你会看到大量类似下面的文字滚动，这是正常的：

```
Compiling proc-macro2 v1.0.x
Compiling unicode-ident v1.0.x
...
Compiling tauri v2.x.x
Compiling app v1.0.0
Finished `release` profile [optimized] target(s) in 8m 32s
```

### ④ 找到打包好的 .exe

成功后会自动打开一个文件夹，里面有类似这个文件：

```
简易 AI 工具箱_1.0.0_x64-setup.exe
```

**双击它就是 Windows 安装包**，跟你装别的软件一样：

- 选安装位置
- 点"安装"
- 桌面会有快捷方式

---

## 完整路径

打包好的安装包位置：

```
simple-ai\src-tauri\target\release\bundle\nsis\简易 AI 工具箱_1.0.0_x64-setup.exe
```

文件大约 5-10 MB（不含 WebView2 运行时）。

---

## ❓ 常见问题

### Q：报错 "linker `link.exe` not found"

A：Rust 装的时候提示要装 "Microsoft C++ Build Tools" 你跳过了。重新跑一次 `rustup-init.exe`，或者去这里下载安装：
https://visualstudio.microsoft.com/visual-cpp-build-tools/

下载并安装时，**勾选「使用 C++ 的桌面开发」** 这一项即可。

### Q：报错 "could not compile `xxx`"

A：网络问题导致下载失败。重新双击 `打包exe.bat` 重试即可。Rust 会自动续传。

### Q：打出来的 .exe 能给别人用吗？

A：能。但接收方电脑需要装 **WebView2 运行时**（Windows 11 自带，Windows 10 大部分也都有）。
如果对方提示需要装 WebView2，去这里下载：
https://developer.microsoft.com/microsoft-edge/webview2/

### Q：能改图标 / 应用名吗？

A：能。改完重新打包：
- 应用名：`src-tauri/tauri.conf.json` 里的 `productName`
- 图标：把你的 1024x1024 PNG 命名为 `source.png` 放进 `scripts/` 文件夹，运行：
  ```powershell
  npx tauri icon scripts/source.png
  ```
  再重新双击 `打包exe.bat`。

### Q：第一次打包卡在某一步很久不动？

A：Rust 编译大型项目就是慢，特别是第一次。看任务管理器，如果 CPU 在跑（cargo.exe / rustc.exe 占用），那就是在干活，耐心等。30 分钟内都属于正常。

### Q：我想不停打包测试，每次都要等很久？

A：之后再打包都是增量编译，会快很多（通常 1-3 分钟）。除非你修改了 Rust 配置或者删了 `src-tauri/target` 目录。

### Q：能跳过打包，先看看桌面应用效果吗？

A：可以。命令行进入 `simple-ai` 后跑：

```powershell
npm run tauri:dev
```

它会打开一个开发模式窗口，可以实时预览。
