# 用户自定义模板可视化

在 **设置 → LaTeX Live → Custom template profiles → Manage / choose profiles** 打开配置窗口，
也可以运行命令 **LaTeX Live: Choose / edit template visualization**。

先打开要配置的 `.tex` 文件。窗口顶部显示这份文件的根文档；选择一个方案并点击
**Save and use selected profile**，就会在这个项目的实时编辑视图中生效。选择
**Automatic (original template)** 可恢复原模板的自动识别。源码模式保持源码显示。

## 配置方案

**New profile** 创建独立方案。方案可以保存中文名称，供多个项目重复选择。
修改同一方案会更新本库中所有使用它的项目；删除方案后，这些项目回到自动识别。
配置只保存在本库的插件设置中，根文档按库内相对路径记录，不写入 `.tex` 或 `.cls`。

逐个环境设置以下规则；例如你的模板使用 `defn`、`thm`，就填写这些实际环境名，
不填写 `\begin` 或花括号。

| 设置 | 作用 |
| --- | --- |
| Rendering | 显示定理类框，或保留环境标记源码；框内其他公式、文字仍遵循实时编辑规则 |
| Heading | 框头的显示名称，例如“定义”“定理”“证明” |
| Color | 用颜色选择器或 `#RRGGBB` 设置框、框头的颜色 |
| Title arguments | 自动识别、无标题参数、可选 `[title]`、必选 `{title}`，或 ElegantBook 的标题/标签形式 |
| Title position | 标题在框头后、加括号、替换框头，或直接作为框头 |
| Numbered | 自动，显示已编译标签的编号，或隐藏编号 |
| Label prefix | 标题/标签形式使用的标签前缀；例如 `thm` 对应 `thm:key` |
| End mark mode / End mark | 自动、无结束符，或自定义纯文本结束符，例如 `□` |

空白字段和 **Auto** 保留自动识别的行为。没有被自动识别的环境，默认不读取标题参数、
不猜测编号；应按真实模板配置参数形式，编号从编译结果的标签读取。

点击 **Add environment** 添加规则。重复环境名、无效颜色和无效规则会显示错误，
不会覆盖当前方案。编辑、导入和删除先保留在窗口草稿里；**Cancel** 放弃草稿。
打开窗口期间配置发生变化，保存会要求重新打开窗口，避免覆盖较新的设置。

## 导入和导出

展开 **Import / export profile JSON**，可从字段更新 JSON 并复制出去。
粘贴另一个方案的 JSON，点击 **Import as a new profile**，会创建独立草稿和新的内部 ID；
仍需保存才生效。例如：

```json
{
  "id": "my-math",
  "name": "我的数学模板",
  "environments": [
    { "environment": "defn", "name": "定义", "color": "#00a652", "arguments": "o", "numbered": true },
    { "environment": "thm", "name": "定理", "color": "#ff8618", "arguments": "o", "numbered": true },
    { "environment": "proof", "name": "证明", "color": "#ff8618", "numbered": false, "qed": "□" }
  ]
}
```

JSON 的 `arguments` 可用 `""`、`"o"`、`"m"`、`"tcb"`、`"tcb*"`；分别对应无参数、
可选标题、必选标题、标题/标签，以及不带标签参数的可选标题。`titlePosition` 可用
`paren`、`after`、`replace`、`name`。`render: "source"` 保留环境标记源码。
导入只接受声明式字段，不执行 HTML、CSS 或 JavaScript。每库最多 30 个方案，
每方案最多 100 条规则；单份导入 JSON 最多 200,000 字符。

## 范围

这一版配置定理类环境的编辑可视化；公式、列表、图片、表格和代码已有独立渲染器，
不能通过规则改成定理框，但可选择保留它们的环境标记源码。
环境头参数需闭合，框头和结束标记需独占所在行，整个环境需在 200 行内闭合。

方案只改变编辑视图。PDF、HTML 导出、引用名称、原生计数器、悬浮的 TeX 片段和证明图
继续使用原始模板及真实编译数据；这里的显示名称不会重定义 TeX 宏或改写笔记。
