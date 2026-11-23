# 增量本地化工具

把「全量表 → 增量 → 四件套翻译 → 机检 QA → 锁定回写」这条专业本地化流水线，做成一个能直接跑的 Python 工具。

配套课程：[增量本地化专题](https://ai-qihang.vercel.app/learn/inc-full-vs-delta)（第 25-30 课）。

## 它解决什么问题

游戏/软件每个版本只改动一小部分文本，但翻译全量既贵又容易引入新错误。这个工具帮你：

1. **算增量**：对比全量表和新版源文，只挑出「新增」和「源文变更」的条目；
2. **四件套翻译**：把术语表 + 风格指导 + 全量表上下文（翻译记忆）+ checklist 一起喂给大模型，术语不漂移；
3. **独立 QA**：脚本硬查漏译、占位符、术语、超长、夹带英文——不依赖 AI，可复现；
4. **锁定回写**：QA 通过才允许写回全量表，标记 `locked` 并记录审计信息。

## 快速开始

```bash
# 1. 准备配置
cp config.example.json config.json
cp glossary.example.md glossary.md
cp style-guide.example.md style-guide.md
# 编辑 config.json 填 api_key（或直接用环境变量）

# 2. 准备数据（或用自带的演示数据）
python make_sample.py           # 生成 sample/full_table.xlsx 和 sample/new_source.xlsx

# 3. 一键跑完整流程
export DEEPSEEK_API_KEY=sk-xxx     # Windows PowerShell: $env:DEEPSEEK_API_KEY="sk-xxx"
python l10n.py run \
  --full sample/full_table.xlsx \
  --new sample/new_source.xlsx \
  --delta sample/delta.xlsx \
  --translated sample/delta_translated.xlsx \
  --out sample/full_table_new.xlsx \
  --report sample/qa_report.json
```

## 分步执行（推荐生产上这样用）

```bash
python l10n.py diff      # 算增量 → delta.xlsx，先人工看一眼增量对不对
python l10n.py translate # 翻译 → delta_translated.xlsx
python l10n.py qa        # 机检 → qa_report.json
python l10n.py lock      # QA 通过才回写 → full_table_new.xlsx
```

分步的好处：每一步都能人工检查和中断，出问题不用从头重跑。

## 参数

| 参数 | 默认 | 说明 |
| --- | --- | --- |
| `--full` | `full_table.xlsx` | 全量表（主表） |
| `--new` | `new_source.xlsx` | 新版源文本 |
| `--delta` | `delta.xlsx` | 增量表 |
| `--translated` | `delta_translated.xlsx` | 译文表 |
| `--out` | `full_table_new.xlsx` | 锁定回写后的全量表 |
| `--report` | `qa_report.json` | QA 报告 |
| `--config` | `config.json` | 配置文件 |

## 配置项（config.json）

| 键 | 说明 |
| --- | --- |
| `api_base` | OpenAI 兼容接口地址，默认 DeepSeek |
| `api_key` | API Key（优先读环境变量 `DEEPSEEK_API_KEY`） |
| `model` | 模型名 |
| `batch_size` | 每批翻译条数，默认 10（太大易跑偏，太小慢） |
| `length_ratio` | 译文长度上限倍数，默认 1.2 |
| `key_col` / `source_col` / `target_col` / `context_col` | 列名映射，适配你自己的表头 |
| `proper_noun_suffixes` | key 以这些后缀结尾视为专有名词，保留英文不判「漏译」 |
| `glossary_file` / `style_guide_file` | 术语表与风格指导路径 |

## 表格式要求

**全量表**（`--full`）：

| key | source | zh | context | status | locked_by | locked_at |
| --- | --- | --- | --- | --- | --- | --- |
| skill_01_name | Rage | 狂暴 | 战士技能名 | locked | | |

**新版源文**（`--new`）：至少要有 `key` 和 `source` 两列（`context` 可选）。

**术语表**：Markdown 表格，靠 `| 英文 | 中文 | …` 格式解析：

```markdown
| 英文 | 中文 | 说明 |
| --- | --- | --- |
| Rage | 狂暴 | 战士技能，勿译「暴怒」 |
```

## 机检规则（QA 都查什么）

| 类型 | 严重度 | 判定 |
| --- | --- | --- |
| 漏译 | 高 | 译文为空 |
| 占位符 | 高 | `{0}`、`%s`、`%d` 数量或内容与源文不一致 |
| 术语 | 高 | 源文含术语表英文，译文既无该英文也无对应中文 |
| 疑似漏译/夹带英文 | 中 | 译文英文占比 > 60%（专有名词后缀除外） |
| 专有名词被翻译 | 中 | `*_name` 类条目的英文原名在译文中丢失 |
| 超长 | 中 | 译文长度 > 源文 × `length_ratio` |

**有「高」严重度问题就拒绝锁定**，`lock` 会直接退出码 1。

## 设计要点（踩过的坑）

1. **锁定必须同时更新 source 列**。只更新译文的话，下一轮 `diff` 会永远把这条判为「变更」，增量永远消不掉。工具里已修复并有幂等性测试。
2. **专有名词要豁免「夹带英文」判定**。风格指导说技能名保留英文，硬检却把它当漏译，是这类工具最常见的误报。用 `proper_noun_suffixes` 区分。
3. **全量表要当上下文喂进去**。只给源文，模型每次从零猜译名，术语必漂。工具按 key 前缀自动挑相关已译条目（每条最多 5 个）。
4. **`diff` / `qa` / `lock` 不需要 API Key**。全程本地计算，只有 `translate` / `run` 才调大模型——省心也省钱。

## 依赖

```bash
pip install openpyxl
```

其余全部标准库（含 HTTP 调用，不依赖 requests）。

## 已验证的行为

- ✅ 增量计算：新增 2 条 + 变更 1 条，与预期一致
- ✅ 幂等性：锁定后再跑 `diff`，增量 0/0
- ✅ QA 拦截：漏译、占位符丢失、术语、专有名词被翻译、超长、夹带英文全部命中
- ✅ 锁定保护：有高严重度问题时拒绝回写
- ✅ 审计字段：只给本轮改动的行写 `locked_by` / `locked_at`

## 下一步可以扩展的方向

- 多语言：把 `target_col` 变成多列，一次输出 N 种语言对照表
- AI 独立评判层：机检通过后再跑一轮「只挑错不改稿」的 AI QA
- 与 Unity/Excel 语言表直连：读 prefab / LanguageKeyPrefabMap
- 锁定的 git 化：每次锁定自动 commit，回退靠 `git revert`
