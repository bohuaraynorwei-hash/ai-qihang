#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""生成演示用的 sample 文件：全量表 + 新版源文。跑完可删。"""

import os

from openpyxl import Workbook

HERE = os.path.dirname(os.path.abspath(__file__))
SAMPLE = os.path.join(HERE, "sample")
os.makedirs(SAMPLE, exist_ok=True)

FULL_COLS = ["key", "source", "zh", "context", "status"]
FULL_ROWS = [
    ["skill_01_name", "Rage", "狂暴", "战士技能名", "locked"],
    ["skill_01_desc", "Unleash your fury to deal damage.", "释放怒火造成伤害。", "战士技能描述", "locked"],
    ["skill_02_name", "Frost", "冰霜", "法师技能名", "locked"],
    ["skill_02_desc", "Chill the target and slow it down.", "冰冻目标并使其减速。", "法师技能描述", "locked"],
    ["ui_save_btn", "Save", "保存", "设置页按钮", "locked"],
    ["ui_continue_btn", "Continue", "继续", "主菜单按钮", "locked"],
    ["ui_confirm_title", "Are you sure?", "确定吗？", "退出确认弹窗标题", "locked"],
    ["ui_confirm_hint", "Your progress will be lost.", "你的进度将丢失。", "退出确认弹窗提示", "locked"],
    ["item_potion_name", "Potion", "药水", "道具名", "locked"],
    ["item_potion_desc", "Restores {0} HP.", "恢复 {0} 点生命值。", "道具描述（占位符示例）", "locked"],
]

NEW_COLS = ["key", "source", "context"]
NEW_ROWS = [
    # 10 条和全量表完全一致
    ["skill_01_name", "Rage", "战士技能名"],
    ["skill_01_desc", "Unleash your fury to deal damage.", "战士技能描述"],
    ["skill_02_name", "Frost", "法师技能名"],
    ["skill_02_desc", "Chill the target and slow it down.", "法师技能描述"],
    ["ui_save_btn", "Save", "设置页按钮"],
    ["ui_continue_btn", "Continue", "主菜单按钮"],
    ["ui_confirm_title", "Are you sure?", "退出确认弹窗标题"],
    ["item_potion_name", "Potion", "道具名"],
    ["item_potion_desc", "Restores {0} HP.", "道具描述（占位符示例）"],
    # 1 条源文变更（重翻）
    ["ui_confirm_hint", "All unsaved progress will be lost.", "退出确认弹窗提示"],
    # 2 条新增
    ["skill_03_name", "Frost Nova", "法师范围技能名"],
    ["skill_03_desc", "Freezes enemies in an area for {0} seconds.", "法师范围技能描述"],
]


def save(path, cols, rows):
    wb = Workbook()
    ws = wb.active
    ws.append(cols)
    for r in rows:
        ws.append(r)
    wb.save(path)


if __name__ == "__main__":
    save(os.path.join(SAMPLE, "full_table.xlsx"), FULL_COLS, FULL_ROWS)
    save(os.path.join(SAMPLE, "new_source.xlsx"), NEW_COLS, NEW_ROWS)
    print("已生成 sample/full_table.xlsx 和 sample/new_source.xlsx")
    print("预期增量：变更 1 条（ui_confirm_hint）+ 新增 2 条（skill_03_*）")
