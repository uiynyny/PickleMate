# PickleMate 领域模型

PickleMate 是一款面向匹克球（Pickleball）运动爱好者的社群与匹配平台，连接球友、球场与活动。

## 术语表 (Language)

**用户 (User)**:
代表平台上的匹克球玩家个体，拥有唯一的身份标识、头像、昵称、DUPR 自测评分，并关联其签到记录、发帖历史和球局参与记录。
_Avoid_: 账户 (Account), 会员 (Member), 客户端 (Client)

**登录凭证 (Credential)**:
用于证明用户身份的唯一标识凭据，包括验证过的手机号、苹果账号标识（Apple User ID）或微信账号标识（WeChat OpenID/UnionID）。一个用户可以绑定多个不同类型的登录凭证。

同一自然人至多对应一个用户（User），不论其以何种登录方式进入。手机号凭证是跨登录方式归并账号的唯一依据：当不同登录方式各自绑定并通过验证同一个手机号时，它们即归并为同一用户。微信 UnionID 仅在微信对微信之间起桥接作用，不能跨登录方式归并。
_Avoid_: 登录方式 (Login Method), 身份验证 (Auth)

**凭证已验证 (Credential Verification)**:
对某条登录凭证真属于该用户本人的确认，通过用户完成对应的验证交换（短信验证码 / 邮箱验证码）而确立。它描述的是"凭证已通过证明"，独立于用户是否为激活用户（Activation），也独立于任何球场的认证状态。
_Avoid_: 已认证 (Verified alone), 已实名 (Real-named)

**未激活用户 (Inactive User)**:
通过第三方（如 Apple 或微信）首次授权登录，但尚未完成手机号绑定与验证的用户。此类用户仅拥有系统内容的浏览与查看权限。
_Avoid_: 游客 (Guest), 匿名用户 (Anonymous User)

**激活用户 (Active User)**:
已成功完成手机号绑定与短信验证码验证的用户。激活用户拥有平台的全部使用权限，包括创建球场、签到打卡、留言板发帖及参与/发起球局。
_Avoid_: 真实用户 (Real User), 完整用户 (Full User)

**平台管理员 (Platform Admin)**:
被授予平台侧管理权限的激活用户。平台管理员可执行不属于普通玩家的事务，尤指对球场进行球场认证（Court Verification）。平台管理员是激活用户的一种特化，而非独立的身份主体。
_Avoid_: 超级用户 (Superuser), 后台 (Backend)

**球场 (Court)**:
代表进行匹克球运动的物理场地。球场具有名称、详细地址、场地数量（片数）、是否室内、是否有照明、网类型及地面类型等物理属性。球场由用户创建，可以被平台认证（Court-Verified）或未认证（Unverified）。
_Avoid_: 场地 (Venue), 球馆 (Facility), 场馆 (Location)

**球场认证 (Court Verification)**:
平台对某球场真实存在、可被列出这一事实的确认。球场处于"球场认证"或"未认证"两种状态之一，由平台（而非球场创建者）设定，且与任何用户的身份证明相互独立。
_Avoid_: 认证 (Verified alone), 已审核 (Approved)

**签到 (Check-In)**:
激活用户在特定球场上申报自己未来计划活动时间段的行为（包含开始时间和结束时间）。签到不产生资金交易，仅作为玩家在该球场上活动的意向展示，用于促进社交匹配。
_Avoid_: 预约 (Reservation), 订场 (Booking)

**球局 (Play Session)**:
由发起人在特定球场上创建的单场拼场活动。球局规定了明确的开赛时间、最大人数、所需的 DUPR 评分技术区间。玩家可以直接加入或退出。
_Avoid_: 活动 (Activity), 拼场 (Matchmaking Session), 比赛 (Match)

**收藏 (Favorite)**:
用户对特定球场的标记。用于快速访问常用的球场，无需再次通过地图搜索。
_Avoid_: 星标 (Star), 收藏夹 (Favorites List)

**聊天室 (Chat Room)**:
围绕特定球场（Court）或特定球局（Play Session）建立的多人实时群聊空间，支持文本、图片、投票（Poll）及消息线程回复（Thread Reply）。
_Avoid_: 频道 (Channel), 讨论组 (Discussion Group)

**私信会话 (DM Conversation)**:
两名用户（User）之间建立的一对一私密实时对话空间。
_Avoid_: 站内信 (Inbox Mail), 悄悄话 (Whisper)



