export default function About() {
  return (
    <div className="pt-4 max-w-2xl mx-auto space-y-4">
      <h1 className="text-2xl font-semibold text-ink-900">关于这个工具</h1>

      <div className="card p-5 space-y-3 text-sm text-ink-700 leading-relaxed">
        <p>
          这是一个<strong>极简</strong>的 AI 工具，给没用过 AI 的朋友设计：
        </p>
        <ul className="list-disc pl-5 space-y-1.5 text-ink-600">
          <li>无需注册、无需登录，没有任何账号体系</li>
          <li>只需填写一个 API 地址和一个 Key 就能用</li>
          <li>所有对话记录只保存在你这台设备上，不会上传</li>
          <li>支持 Web 浏览器、Windows / macOS 桌面、Android 手机</li>
          <li>开源免费</li>
        </ul>
      </div>

      <div className="card p-5 space-y-2 text-sm">
        <h2 className="font-semibold text-ink-900">数据存在哪里？</h2>
        <p className="text-ink-600 leading-relaxed">
          所有数据（API 配置 + 对话记录）都保存在浏览器的 LocalStorage 中。
          换设备 / 清浏览器缓存 = 数据会清空。
        </p>
      </div>

      <div className="card p-5 space-y-2 text-sm">
        <h2 className="font-semibold text-ink-900">命理免责声明</h2>
        <p className="text-ink-600 leading-relaxed">
          命理工具基于 AI 推断，结果<strong>仅供参考</strong>，请理性看待，不要据此做出重大决策。
        </p>
      </div>

      <div className="card p-5 text-sm">
        <h2 className="font-semibold text-ink-900 mb-1">协议</h2>
        <p className="text-ink-600 leading-relaxed">
          本应用代码遵循 MIT 协议。
        </p>
      </div>
    </div>
  )
}
