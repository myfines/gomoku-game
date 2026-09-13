# 小游戏

## 本地运行

无需安装项目依赖。Windows 上可直接双击 `index.html`，浏览器会打开五子棋；扫雷在 `minesweeper.html`。

也可以在项目目录启动本地网页服务器：

```powershell
py -m http.server 8000
```

然后访问 `http://localhost:8000/` 玩五子棋，访问 `http://localhost:8000/minesweeper.html` 玩扫雷。按 `Ctrl+C` 停止服务器。`py` 命令不可用时可改用 `python -m http.server 8000`。

## 五子棋 AI 策略

当前 AI 使用附近候选点排序、活三/冲四线型评估、限时迭代加深 alpha-beta、置换表，以及搜索末端对一步胜棋和唯一必堵点的战术延伸。默认最多搜索 6 层，受 90 毫秒和节点数限制；棋盘状态在搜索期间不会被改动。

开源路线对比：

- [Rapfi](https://github.com/dhbloo/rapfi)：alpha-beta 加经典评估和 NNUE；项目为 GPL-3.0，并提供 WebAssembly 构建路径。
- [rdragon/gomoku-ai](https://github.com/rdragon/gomoku-ai)：结合 alpha-beta 与威胁空间搜索，也列出证明数搜索（PNS）选项。
- [AlphaZero_Gomoku](https://github.com/junxiaosong/alphazero_gomoku)：自我对弈、MCTS 与策略/价值网络路线，需要训练和模型。

本项目采用独立实现的浏览器内搜索，没有复制或依赖上述引擎。后续值得尝试的是更完整的威胁空间搜索或将 Rapfi 编译为 WebAssembly。

## 测试

安装 Node.js 后，在项目目录运行：

```sh
node --test
```
