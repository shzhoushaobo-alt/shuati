# AI 题库刷题应用

支持手机访问的网页刷题应用，包含：

- 无限刷题模式（做完一题立即判对错，显示正确答案）
- 测试模式（全部做完后统一交卷）
- 错题本（错题自动进入；后续做对自动移出）
- 答案导入/导出（便于后续补全标准答案）

## 目录说明

- `index.html`：页面入口
- `app.js`：应用逻辑
- `styles.css`：样式
- `questions.json`：题库（当前共 499 题）
- `extract_questions.py`：题库提取脚本

## 本地运行

在当前目录执行：

```bash
python3 -m http.server 8080
```

手机和电脑在同一局域网时，手机浏览器打开：

`http://你的电脑局域网IP:8080`

## 部署到公网（GitHub Pages）

仓库已包含 GitHub Actions 工作流：推送 `main` 或 `master` 分支后会自动发布静态站点。

1. 在 GitHub 新建一个空仓库（不要勾选添加 README）。
2. 在本项目目录执行（把 `你的用户名/仓库名` 换成自己的）：

```bash
cd "/Users/Nicholas/Documents/AI coding/刷题应用"
git init
git add index.html app.js styles.css questions.json vercel.json .gitignore .github
git commit -m "Initial quiz app"
git branch -M main
git remote add origin https://github.com/你的用户名/仓库名.git
git push -u origin main
```

3. 打开 GitHub 仓库：**Settings → Pages**，在 **Build and deployment** 里把 **Source** 选成 **GitHub Actions**。
4. 等待 **Actions** 里绿色勾完成。站点地址一般为：

`https://你的用户名.github.io/仓库名/`

若首页 404，在地址末尾加上 `index.html` 再试一次。

**若 Actions 报错 `cp: cannot stat 'index.html'`：** 说明远程仓库根目录里没有网站文件，只有 workflow。请把 `index.html`、`app.js`、`styles.css`、`questions.json` 与 `.github/workflows/deploy-pages.yml` **放在同一仓库、同一根目录** 后再 push。

## 答案说明

`questions.json` 中已带有预测答案（便于先刷后校正）。你可以：

1. 在页面 `答案管理` 中导入/导出答案 JSON；
2. 在无限刷题里使用「将当前作答设为最终答案」覆盖本地标准答案（浏览器本地存储）。

答案导入 JSON 示例：

```json
{
  "1": ["B"],
  "2": ["B"],
  "351": ["T"]
}
```
