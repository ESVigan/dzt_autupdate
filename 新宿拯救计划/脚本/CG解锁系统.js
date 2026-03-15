// CG Unlocking & Session Tracking Manager
// 依赖：MVU 变量框架（酒馆助手插件）
// 触发时机：Mvu.events.VARIABLE_UPDATE_ENDED（每次变量更新后）
// 标签格式：<插图>文件名</插图>（如 <插图>绘里奈-游乐园1</插图>）
//
// 【重 Roll 安全策略】
//   - AI 回复时：只写消息变量 $当前聊天已现CG，不写角色变量 _CG相册
//   - 用户发下一条消息时：读上一条 AI 楼层的消息变量，合并进角色变量
//   - 重 Roll 只是替换当前楼层的 swipe，不触发"用户确认"，不影响角色变量

(async function () {
  console.log("🌸 [CG Manager] Init");

  // ============================================================
  // 所有 CG 的初始默认状态（全部 false）
  // 通过 insertVariables 懒注入到角色变量
  // ============================================================
  const defaultCGState = {
    "林绛-一人生日": false,
    "林绛-吃饭团1": false,
    "林绛-吃饭团2": false,
    "林绛-吃泡面": false,
    "林绛-大学食堂": false,
    "林绛-家中学习": false,
    "林绛-街头迷茫": false,
    "林绛-看动画": false,
    "林绛-末班车1": false,
    "林绛-末班车2": false,
    "林绛-试音": false,
    "林绛-图书馆": false,
    "林绛-图书馆2": false,
    "林绛-贩售机": false,
    "林绛-婚纱": false,
    "林绛-学习下厨": false,
    "林绛-学习配音": false,
    "林绛-学习配音2": false,
    "绾音-KTV": false,
    "绾音-车站等人": false,
    "绾音-公园约会": false,
    "绾音-和服": false,
    "绾音-咖啡馆约会": false,
    "绾音-水族馆约会1": false,
    "绾音-水族馆约会2": false,
    "绾音-天台": false,
    "绾音-夏日祭": false,
    "由美-安稳睡着": false,
    "由美-白无垢1": false,
    "由美-白无垢2": false,
    "由美-便利店打工": false,
    "由美-茶道": false,
    "由美-超市采购": false,
    "由美-车站等待": false,
    "由美-初次接待1": false,
    "由美-初次接待2": false,
    "由美-对镜审视": false,
    "由美-缝纫1": false,
    "由美-缝纫2": false,
    "由美-和服1": false,
    "由美-和服2": false,
    "由美-花店买花": false,
    "由美-居家": false,
    "由美-看着婚戒惆怅": false,
    "由美-门外催债人": false,
    "由美-疲惫归家": false,
    "由美-深夜迷茫": false,
    "由美-神社祈福": false,
    "由美-算账": false,
    "由美-下厨": false,
    "由美-洗浴后": false,
    "由美-洗衣服": false,
    "由美-夕阳下的归家": false,
    "由美-一人生日": false,
    "由美-约会": false,
    "绘里奈-KTV": false,
    "绘里奈-便利店": false,
    "绘里奈-餐厅约会": false,
    "绘里奈-尝试下厨": false,
    "绘里奈-刷爆信用卡": false,
    "绘里奈-等回短信": false,
    "绘里奈-公园喂猫": false,
    "绘里奈-旧全家福": false,
    "绘里奈-街头淋雨": false,
    "绘里奈-酒吧": false,
    "绘里奈-酒店独坐": false,
    "绘里奈-咖啡馆约会": false,
    "绘里奈-噩梦醒来": false,
    "绘里奈-抓娃娃": false,
    "绘里奈-上学时": false,
    "绘里奈-深夜网咖": false,
    "绘里奈-生日蛋糕": false,
    "绘里奈-涩谷街头": false,
    "绘里奈-索吻": false,
    "绘里奈-天台远眺": false,
    "绘里奈-午夜街头": false,
    "绘里奈-西餐厅吃和牛": false,
    "绘里奈-婚纱1": false,
    "绘里奈-婚纱2": false,
    "绘里奈-游乐园1": false,
    "绘里奈-游乐园2": false,
    "绘里奈-游乐园3": false,
    "other_group_01": false
  };

  // ============================================================
  // Step 1：懒注入默认角色变量（只在不存在时插入）
  // ============================================================
  function ensureCharacterCGVariables() {
    if (typeof insertVariables !== "undefined") {
      try {
        insertVariables({ _CG相册: defaultCGState }, { type: "character" });
        console.log("[CG Manager] 角色变量初始化完成");
      } catch (e) {
        setTimeout(ensureCharacterCGVariables, 2000);
      }
    } else {
      setTimeout(ensureCharacterCGVariables, 2000);
    }
  }
  ensureCharacterCGVariables();

  // ============================================================
  // Step 2：等待 MVU 框架初始化完毕
  // ============================================================
  await waitGlobalInitialized("Mvu");
  console.log("[CG Manager] MVU 已就绪，注册事件监听");

  // ============================================================
  // Step 3：监听 MVU 变量更新完成事件
  //
  // 角色为 'assistant'（AI 回复）时：
  //   - 扫描 formatAsTavernRegexedString(..., 'prompt') 结果中的 <插图> 标签
  //   - 只写入消息变量 $当前聊天已现CG（走 MVU 管道，直接修改 new_variables）
  //   - 【不写】角色变量 _CG相册，防止重 Roll 时虚假解锁被永久记录
  //
  // 角色为 'user'（用户发送下一条）时：
  //   - 用户发新消息意味着确认了上一条 AI 回复（不再 Roll）
  //   - 读取上一条 AI 楼层（message_id: -2）的 $当前聊天已现CG
  //   - 把其中 true 的条目合并（追加）进角色变量 _CG相册
  // ============================================================
  const CG_REGEX = /<插图>([^<\n\s]+)<\/插图>/g;

  eventOn(Mvu.events.VARIABLE_UPDATE_ENDED, (new_variables) => {
    const messages = getChatMessages(-1);
    if (!messages || messages.length === 0) return;
    const msg = messages[0];

    // ── A. AI 回复：检测 CG，只写消息变量 ──────────────────────
    if (msg.role === "assistant") {
      // 以 'prompt' 为目标处理文本：思维链的「仅格式显示」正则不执行
      // 确保只扫描正文里真正输出的 <插图> 标签
      const promptText = formatAsTavernRegexedString(
        msg.message,
        "ai_output",
        "prompt",
        { depth: 0 },
      );

      CG_REGEX.lastIndex = 0;
      let match;
      const found = [];

      while ((match = CG_REGEX.exec(promptText)) !== null) {
        const cgId = match[1].trim();
        if (!cgId) continue;
        found.push(cgId);
        // 写入消息变量（MVU 接管保存到当前 swipe）
        _.set(new_variables, `stat_data.$当前聊天已现CG.${cgId}`, true);
      }

      if (found.length > 0) {
        console.log("[CG Manager] AI 楼检测到 CG，已写入消息变量:", found);
        console.log("[CG Manager] 角色变量将在用户确认后更新");
      }
      return;
    }

    // ── B. 用户发消息：确认上一条 AI 回复，同步到角色变量 ──────
    if (msg.role === "user") {
      try {
        // 读取上一条 AI 楼层的变量（当前用户楼是 -1，AI 楼是 -2）
        const prevAiMessages = getChatMessages(-2);
        if (!prevAiMessages || prevAiMessages.length === 0) return;
        const prevAiMsg = prevAiMessages[0];
        if (prevAiMsg.role !== "assistant") return;

        const prevVars = getVariables({
          type: "message",
          message_id: prevAiMsg.message_id,
        });
        const seenCGs = prevVars?.stat_data?.$当前聊天已现CG || {};

        // 只追加，不替换：合并 true 的条目进角色变量
        const newEntries = {};
        for (const [cgId, seen] of Object.entries(seenCGs)) {
          if (seen === true) {
            newEntries[cgId] = true;
          }
        }

        if (Object.keys(newEntries).length > 0) {
          insertOrAssignVariables(
            { _CG相册: newEntries },
            { type: "character" },
          );
          console.log(
            "[CG Manager] 用户确认，已合并进角色变量 _CG相册:",
            Object.keys(newEntries),
          );
        }
      } catch (e) {
        console.error("[CG Manager] 同步角色变量失败:", e);
      }
    }
  });

  console.log("[CG Manager] 事件监听已注册: Mvu.events.VARIABLE_UPDATE_ENDED");

  // ============================================================
  // Step 4：全局全屏 CG 查看函数
  // ============================================================
  window.openCgFullscreen = function (url) {
    let modal = document.getElementById("st-cg-fullscreen-modal");
    if (!modal) {
      modal = document.createElement("div");
      modal.id = "st-cg-fullscreen-modal";
      modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100vw;
        height: 100vh;
        background: rgba(0, 0, 0, 0.9);
        display: none;
        justify-content: center;
        align-items: center;
        z-index: 10001;
        cursor: pointer;
        backdrop-filter: blur(5px);
      `;
      modal.innerHTML = `
        <img id="st-cg-fullscreen-img" style="max-width: 95%; max-height: 95%; object-fit: contain; box-shadow: 0 0 30px rgba(0,0,0,0.5); border: 2px solid rgba(255,255,255,0.2); border-radius: 8px;">
        <div style="position: absolute; top: 20px; right: 20px; color: #fff; font-size: 30px; opacity: 0.7;"><i class="fas fa-times"></i></div>
      `;
      modal.onclick = () => (modal.style.display = "none");
      document.body.appendChild(modal);
    }
    const img = document.getElementById("st-cg-fullscreen-img");
    img.src = url;
    modal.style.display = "flex";
  };
})();
