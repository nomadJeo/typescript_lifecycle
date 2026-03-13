# Demo4tests 15 个项目：人工审查 vs ArkAnalyzer 对比报告

## 1. 概述

本报告对 Demo4tests 下 15 个鸿蒙 ArkTS 项目进行**人工资源/污点泄漏审查**，并与 **ArkAnalyzer LifecycleAnalyzer** 的分析结果进行对比，评估分析器在**数量**和**位置**上的准确性。

### 1.1 项目列表

| # | 项目名 | 路径 |
|---|--------|------|
| 1 | Accouting_ArkTS-master | Accouting_ArkTS-master |
| 2 | ClashBox-master | ClashBox-master |
| 3 | HarmoneyOpenEye-master | HarmoneyOpenEye-master |
| 4 | interview-handbook-project-next | interview-handbook-project-next |
| 5 | open_neteasy_cloud-main | open_neteasy_cloud-main |
| 6 | RingtoneKit_Codelab_Demo | RingtoneKit_Codelab_Demo |
| 7 | OxHornCampus | OxHornCampus/OxHornCampus |
| 8 | CloudFoundationKit | CloudFoundationKit_Codelab_Prefetch_ArkTS/prefetch-code-lab |
| 9 | UIDesignKit_Nav | UIDesignKit_HdsNavigation_Codelab/... |
| 10 | MultiVideoApplication | MultiVideoApplication |
| 11 | MusicHome | MusicHome |
| 12 | DistributedMail | DistributedMail |
| 13 | Transition_Before | TransitionPerformanceIssue/BeforeOptimization |
| 14 | ColdStart_Before | ColdStartPerformanceIssue-master/BeforeOptimization |
| 15 | PageSlip_Before | PageSlipPerformanceIssue-master/BeforeOptimization |

---

## 2. 人工审查结果（按项目）

### 2.1 前五个项目（已有结论）

| 项目 | 人工确认泄漏 | 位置 | 说明 |
|------|-------------|------|------|
| Accouting_ArkTS-master | 1 | RdbHelperImp.ets:27 | `dataRdb.getRdbStore` 未 close |
| ClashBox-master | 4 确认 + 1 可能 | EntryAbility:135 setInterval；Index:564,594,775 fs.openSync；ProfileRepo:15 getRdbStore；SimpleAVPlayer:44 createAVPlayer；Connect.ets:70；Request.ets:44；HHmmssTimer:25 等 setInterval（部分在 aboutToDisappear 中有 clearInterval） | 部分 setInterval 有 clearInterval 配对 |
| HarmoneyOpenEye-master | 0 | - | 无确认泄漏 |
| interview-handbook-project-next | 1 | WordSoundDialog.ets:36 | `fs.open` 未 close（file handle 泄漏） |
| open_neteasy_cloud-main | 0 | - | 无确认泄漏 |

### 2.2 新增 10 个项目（人工审查）

| 项目 | 人工确认泄漏 | 位置 | 说明 |
|------|-------------|------|------|
| RingtoneKit_Codelab_Demo | 0 | - | 无 Source/Sink 调用 |
| OxHornCampus | 1 | TrainsTrack.ets:196 | `setInterval` 在 onReady 回调内，返回值未保存，无法 clearInterval，**真实泄漏** |
| CloudFoundationKit | 0 | - | 无 Source/Sink 调用 |
| UIDesignKit_Nav | 0 | - | 无 Source/Sink 调用 |
| MultiVideoApplication | 1 | AvPlayerUtil.ets（间接：VideoPlayer 使用后未 release） | VideoPlayer.aboutToDisappear 未调用 avPlayerUtil.release()，AvPlayer 持有可能泄漏 |
| MusicHome | 1 | MusicControlComponent.ets:219 | setInterval 在 onChange 内，aboutToDisappear 未 clearInterval，**真实泄漏** |
| DistributedMail | 0 | - | 无 Source/Sink 调用 |
| Transition_Before | 0 | - | BottomTabPage.ets:166 fs.openSync 同块内 fs.closeSync，无泄漏 |
| ColdStart_Before | 0 | - | 未发现 createAVPlayer/setInterval/fs.open/getRdbStore |
| PageSlip_Before | 0 | - | 未发现 Source/Sink |

### 2.3 OxHornCampus Splash.ets 说明

- **Splash.ets:49** 有 `setInterval`，但 **aboutToDisappear** 调用 `clearTiming()` → `clearInterval(this.timer)`，**无泄漏**。
- ArkAnalyzer 报告此处为泄漏，属于**误报**（未正确建立 clearInterval 与 aboutToDisappear 的配对）。

---

## 3. ArkAnalyzer 分析结果（SUMMARY 输出）

| 项目 | sources | sinks | resourceLeaks | leakDetails 数量 | 泄漏位置 |
|------|---------|-------|---------------|-----------------|----------|
| Accouting_ArkTS-master | 0 | 0 | 0 | 0 | - |
| ClashBox-master | 45 | 21 | 15 | 5 | Connect.ets:70, Request.ets:44, Index.ets:564,594, HHmmssTimer.ets:25 |
| HarmoneyOpenEye-master | 2 | 0 | 0 | 0 | - |
| interview-handbook-project-next | 6 | 6 | 5 | 2 | BootView.ets:12, WordSoundDialog.ets:114 |
| open_neteasy_cloud-main | 0 | 0 | 0 | 0 | - |
| RingtoneKit_Codelab_Demo | 0 | 0 | 0 | 0 | - |
| OxHornCampus | 3 | 1 | 1 | 1 | Splash.ets:49 |
| CloudFoundationKit | 0 | 0 | 0 | 0 | - |
| UIDesignKit_Nav | 0 | 0 | 0 | 0 | - |
| MultiVideoApplication | 0 | 0 | 0 | 0 | - |
| MusicHome | 1 | 2 | 1 | 1 | MusicControlComponent.ets:219 |
| DistributedMail | 0 | 0 | 0 | 0 | - |
| Transition_Before | 1 | 0 | 0 | 0 | - |
| ColdStart_Before | 7 | 0 | 0 | 0 | - |
| PageSlip_Before | 4 | 0 | 0 | 0 | - |

---

## 4. 人工 vs ArkAnalyzer 对比汇总

| 项目 | 人工泄漏数 | ArkAnalyzer 泄漏数 | 一致? | 漏报（人工有、分析器无） | 误报（分析器有、人工无） |
|------|-----------|-------------------|------|--------------------------|--------------------------|
| Accouting_ArkTS-master | 1 | 0 | 否 | RdbHelperImp.ets:27 getRdbStore | - |
| ClashBox-master | 4~5 | 5 (leakDetails) / 15 (总数) | 部分 | EntryAbility setInterval、Index saveLog fs.openSync、ProfileRepo getRdbStore、SimpleAVPlayer | 部分 setInterval 有 clearInterval 配对，可能误报 |
| HarmoneyOpenEye-master | 0 | 0 | 是 | - | - |
| interview-handbook-project-next | 1 | 2 (leakDetails) | 否 | WordSoundDialog.ets:36 fs.open | BootView.ets:12（有 clearInterval 为误报） |
| open_neteasy_cloud-main | 0 | 0 | 是 | - | - |
| RingtoneKit_Codelab_Demo | 0 | 0 | 是 | - | - |
| OxHornCampus | 1 | 1 | 否 | TrainsTrack.ets:196 setInterval | Splash.ets:49（有 clearInterval 为误报） |
| CloudFoundationKit | 0 | 0 | 是 | - | - |
| UIDesignKit_Nav | 0 | 0 | 是 | - | - |
| MultiVideoApplication | 1 | 0 | 否 | AvPlayerUtil/VideoPlayer 未 release | - |
| MusicHome | 1 | 1 | 是 | - | - |
| DistributedMail | 0 | 0 | 是 | - | - |
| Transition_Before | 0 | 0 | 是 | - | - |
| ColdStart_Before | 0 | 0 | 是 | - | - |
| PageSlip_Before | 0 | 0 | 是 | - | - |

---

## 5. 问题分析

### 5.1 漏报（False Negative）

| 类型 | 项目/位置 | 可能原因 |
|------|-----------|----------|
| getRdbStore | Accouting_ArkTS-master RdbHelperImp.ets:27 | SourceSinkManager 可能未匹配 `dataRdb.getRdbStore` 或 `relationalStore` 的调用形式 |
| fs.open | interview-handbook WordSoundDialog.ets:36 | `fs.open` 路径可能未覆盖，或 DummyMain 未覆盖该组件 |
| fs.openSync | ClashBox Index.ets:775 | 同上，fs 相关 Source 规则或路径覆盖不足 |
| getRdbStore | ClashBox ProfileRepo.ets:15 | relationalStore / getRdbStore 规则未匹配 |
| setInterval | ClashBox EntryAbility.ets:135 | EntryAbility 可能不在 DummyMain 可达路径，或 setInterval 未被识别为 Source |
| createAVPlayer | ClashBox SimpleAVPlayer.ets:44 | 同上，可能未被 DummyMain 到达 |
| setInterval | OxHornCampus TrainsTrack.ets:196 | setInterval 返回值未赋给变量，或 onReady 回调内调用未被建模 |
| createAVPlayer | MultiVideoApplication AvPlayerUtil.ets:126 | sources=0，DummyMain 可能未到达 AvPlayerUtil.createAvPlayer |

### 5.2 误报（False Positive）

| 类型 | 项目/位置 | 可能原因 |
|------|-----------|----------|
| setInterval | interview-handbook BootView.ets:12 | aboutToDisappear 中有 clearInterval，分析器未建立配对 |
| setInterval | OxHornCampus Splash.ets:49 | 同上，clearTiming → clearInterval 在 aboutToDisappear 中，分析器未正确追踪 |
| setInterval | ClashBox 部分组件 | 在 EventHub/onChange 等回调中的 clearInterval 未被正确建模，导致误报 |

### 5.3 根本原因归纳

1. **Source/Sink 规则不全**：`dataRdb.getRdbStore`、`relationalStore.getRdbStore`、`fs.open`、`fs.openSync` 等可能未完全匹配。
2. **生命周期建模局限**：`aboutToDisappear` 中对 `clearInterval` 的调用未被正确关联到 `setInterval`，导致误报。
3. **DummyMain 覆盖不足**：部分 Ability/Component（如 EntryAbility、ProfileRepo、AvPlayerUtil）未被 DummyMain 入口覆盖，导致 Source 未被扫描到（sources=0）。
4. **回调/异步建模**：onReady、onChange、EventHub 等回调中的 setInterval/clearInterval 配对难以静态分析。
5. **RdbStore.close 规则**：可能缺少对 RdbStore 释放点的 Sink 规则。

---

## 6. 改进建议

1. **扩展 Source 规则**：增加 `fs.open`、`fs.openSync`、`dataRdb.getRdbStore`、`relationalStore.getRdbStore` 的匹配。
2. **扩展 Sink 规则**：增加 `RdbStore.close`、`fs.close`、`fs.closeSync` 的匹配。
3. **强化生命周期配对**：在 Taint 分析中显式追踪 `aboutToDisappear` → `clearInterval` 的配对，减少 setInterval 误报。
4. **扩大 DummyMain 覆盖**：确保 EntryAbility、全局单例（如 AvPlayerUtil、MediaService）的初始化路径被纳入分析入口。
5. **回调内 setInterval**：对 onReady、onChange 等回调内的 setInterval，若返回值未存储，应更保守地报告泄漏。

---

## 7. 统计摘要

- **人工确认泄漏总数**：约 8~9 处（跨 8 个项目）
- **ArkAnalyzer 报告泄漏**：leakDetails 共 10 条（ClashBox 5 + interview 2 + OxHornCampus 1 + MusicHome 1）
- **漏报**：至少 6 处（Accouting getRdbStore、interview fs.open、ClashBox 多处、OxHornCampus TrainsTrack、MultiVideo AvPlayerUtil）
- **误报**：至少 2 处（BootView.ets:12、Splash.ets:49）
- **完全一致项目**：HarmoneyOpenEye、open_neteasy_cloud、RingtoneKit、UIDesignKit、DistributedMail、Transition、ColdStart、PageSlip（8 个）
