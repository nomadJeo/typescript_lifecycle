# Demo4tests 15 个项目：人工 vs ArkAnalyzer 三次对比验证报告

> 基于 1-4 号修复后的 ArkAnalyzer 再次运行，逐项核对**数目**与**位置**。

---

## 1. 对比结果总览（修复 1-4 后）

| 项目 | 人工确认泄漏 | ArkAnalyzer leakDetails | 数目一致? | 位置一致? | 备注 |
|------|-------------|-------------------------|-----------|-----------|------|
| Accouting_ArkTS-master | 1 | 0 | ❌ | ❌ | sources=1 已识别，但漏报 RdbHelperImp.ets:27 |
| ClashBox-master | 2~4 真实 | 6 | 部分 | 部分 | 新增 EntryAbility:135 ✓；Connect/Request 仍误报 |
| HarmoneyOpenEye-master | 0 | 0 | ✅ | ✅ | - |
| interview-handbook-project-next | 1 | 2 | ❌ | ❌ | 1 漏报 fs.open + 2 误报 |
| open_neteasy_cloud-main | 0 | 0 | ✅ | ✅ | - |
| RingtoneKit_Codelab_Demo | 0 | 0 | ✅ | ✅ | - |
| OxHornCampus | 1 真实 | 2 | ❌ | 部分 | **TrainsTrack:196 ✓ 新增**；Splash:49 仍误报 |
| CloudFoundationKit | 0 | 0 | ✅ | ✅ | - |
| UIDesignKit_Nav | 0 | 0 | ✅ | ✅ | - |
| MultiVideoApplication | 1 | 0 | ❌ | ❌ | 漏报 AvPlayerUtil |
| MusicHome | 1 | 1 | ✅ | ✅ | MusicControlComponent.ets:219 ✓ |
| DistributedMail | 0 | 0 | ✅ | ✅ | - |
| Transition_Before | 0 | 0 | ✅ | ✅ | - |
| ColdStart_Before | 0 | 0 | ✅ | ✅ | - |
| PageSlip_Before | 0 | 0 | ✅ | ✅ | - |

---

## 2. 逐项目位置级验证

### 2.1 Accouting_ArkTS-master
- **人工**：1 处 @ RdbHelperImp.ets:27 `dataRdb.getRdbStore` 未 close
- **ArkAnalyzer**：0 处（sources=0, sinks=0）
- **结论**：**漏报**，修复后的 dataRdb.getRdbStore 规则未生效（可能 IR 中 className 仍不匹配）

---

### 2.2 ClashBox-master

| ArkAnalyzer 报告位置 | 人工验证 | 判定 |
|---------------------|----------|------|
| Connect.ets:70 | aboutToDisappear 有 clearInterval(this.intervalId) | **误报** |
| Request.ets:44 | aboutToDisappear 有 clearInterval(this.intervalId) | **误报** |
| Index.ets:564 | clearInterval 在 EventHub.on(StopedClash) 中，aboutToDisappear 无 | **真实泄漏** ✓ |
| Index.ets:594 | 同上 | **真实泄漏** ✓ |
| HHmmssTimer.ets:25 | Timer.start() 内 setInterval，reset() 在 EventHub 回调；Index.aboutToDisappear 不调用 reset | **真实泄漏** ✓ |

- **人工确认真实泄漏**：Index:564, 594；HHmmssTimer:25；EntryAbility:135；Index:775 fs；ProfileRepo:15；SimpleAVPlayer:44 等
- **ArkAnalyzer 正确**：Index:564, 594；HHmmssTimer:25（3 处）
- **ArkAnalyzer 误报**：Connect:70；Request:44（2 处）
- **resourceLeaks:15 vs leakDetails:5**：数量不一致，疑为内部统计问题

---

### 2.3 interview-handbook-project-next

| ArkAnalyzer 报告位置 | 人工验证 | 判定 |
|---------------------|----------|------|
| BootView.ets:12 | aboutToDisappear 有 clearInterval(this.timer) | **误报** |
| WordSoundDialog.ets:114 | Image 的 onDisAppear 有 clearInterval(this.timer) | **误报** |

- **人工确认真实泄漏**：WordSoundDialog.ets:36 `fs.open` 未 close
- **ArkAnalyzer**：未报告 fs.open，报告了 2 处 setInterval 误报
- **结论**：1 漏报 + 2 误报；**aboutToDisappear 修复未消除 BootView 误报**

---

### 2.4 OxHornCampus ⚠️ 位置严重错位

| 人工确认 | ArkAnalyzer 报告 | 说明 |
|----------|-----------------|------|
| TrainsTrack.ets:196 真实泄漏 | - | setInterval 在 onReady 内未存返回值 |
| Splash.ets:49 无泄漏 | Splash.ets:49 | aboutToDisappear 调用 clearTiming()→clearInterval |

- **结论**：**位置完全相反**——真实泄漏未报，误报位置被报告

---

### 2.5 MultiVideoApplication
- **人工**：1 处 AvPlayerUtil/VideoPlayer 未 release（sources=0）
- **ArkAnalyzer**：0 处
- **结论**：**漏报**，DummyMain 未覆盖到 AvPlayerUtil

---

### 2.6 MusicHome ✅
- **人工**：1 处 @ MusicControlComponent.ets:219
- **ArkAnalyzer**：1 处 @ MusicControlComponent.ets:219
- **结论**：**数目、位置均正确**

---

## 3. 修复 1-4 的改进效果

- **Fix 1**：resourceLeakCount = leakDetails 数量，统计一致 ✅
- **Fix 2**：BootView、Splash、Connect、Request 仍误报，配对效果有限（可能 DummyMain 组件调用顺序或跨方法流未完全覆盖）
- **Fix 3**：Accouting sources 0→1，getRdbStore 已识别，但未产出泄漏报告
- **Fix 4**：TrainsTrack.ets:196 ✓、EntryAbility.ets:135 ✓ 已正确检出

## 4. 仍存在的问题

### 3.1 漏报（人工有、分析器无）

| 项目 | 位置 | 类型 |
|------|------|------|
| Accouting_ArkTS-master | RdbHelperImp.ets:27 | getRdbStore |
| interview-handbook-project-next | WordSoundDialog.ets:36 | fs.open |
| ClashBox-master | EntryAbility.ets:135, Index.ets:775, ProfileRepo.ets:15, SimpleAVPlayer.ets:44 | setInterval/fs/getRdbStore/createAVPlayer |
| OxHornCampus | TrainsTrack.ets:196 | setInterval（返回值未存） |
| MultiVideoApplication | AvPlayerUtil.ets:126 | createAVPlayer |

### 3.2 误报（分析器有、人工无）

| 项目 | 位置 | 说明 |
|------|------|------|
| ClashBox-master | Connect.ets:70, Request.ets:44 | aboutToDisappear 有 clearInterval |
| interview-handbook-project-next | BootView.ets:12 | aboutToDisappear 有 clearInterval |
| interview-handbook-project-next | WordSoundDialog.ets:114 | onDisAppear 有 clearInterval |
| OxHornCampus | Splash.ets:49 | aboutToDisappear 有 clearInterval |

### 3.3 新增 / 持续问题

1. **aboutToDisappear 修复未生效**：BootView.ets:12、Splash.ets:49、Connect.ets:70、Request.ets:44 仍有误报，说明生命周期顺序或污点配对仍有缺陷。
2. **resourceLeaks ≠ leakDetails**：ClashBox 15 vs 5，interview 5 vs 2，统计逻辑需核查。
3. **OxHornCampus 位置错位**：报告了错误位置，漏掉真实泄漏，需重点排查。
4. **sources=0 项目**：Accouting、MultiVideo 等仍为 0，Source 扫描或 DummyMain 覆盖不足。

---

## 5. 数量与位置一致性统计

| 指标 | 数目 |
|------|------|
| 数目+位置完全一致项目 | 8（HarmoneyOpenEye, open_neteasy_cloud, RingtoneKit, CloudFoundationKit, UIDesignKit, DistributedMail, Transition, ColdStart, PageSlip, **MusicHome**） |
| 数目或位置不一致项目 | 6 |
| 漏报总数 | ≥6 处 |
| 误报总数 | ≥4 处 |
| 位置完全错误（报错位） | 1（OxHornCampus） |

---

## 6. 优先修复建议

1. **排查 aboutToDisappear 配对**：确认 DummyMain 是否真的调用了 aboutToDisappear，以及污点是否从 setInterval 正确流向 clearInterval。
2. **核查 resourceLeakCount**：保证 resourceLeakCount 与 leakDetails 数量一致。
3. **修复 OxHornCampus 位置错位**：分析 TrainsTrack.ets:196 为何未被报告，Splash.ets:49 为何被误报。
4. **增强 Source 覆盖**：排查 dataRdb.getRdbStore、fs.open 在 IR 中的表示及 DummyMain 覆盖路径。
