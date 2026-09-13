# 小游戏

打开 [index.html](index.html) 玩五子棋，可选先手（黑棋）或后手（白棋）；打开 [minesweeper.html](minesweeper.html) 玩扫雷。两款游戏都可直接在浏览器本地运行，无需安装依赖。

五子棋 AI 使用本地实现的攻防线型评估、附近候选点排序和三层 alpha-beta 搜索。策略选型参考了 [Rapfi](https://github.com/dhbloo/rapfi) 的 alpha-beta 搜索路线；[AlphaZero_Gomoku](https://github.com/junxiaosong/alphazero_gomoku) 展示了另一种通过自我对弈、MCTS 和策略价值网络训练的路线。本项目没有复制或依赖这两个引擎。

## 规则测试

```sh
node --test
```
