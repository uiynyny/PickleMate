# PickleMate 领域模型

PickleMate 是一款面向匹克球（Pickleball）运动爱好者的社群与匹配平台，连接球友、球场与活动。

## 术语表 (Language)

**用户 (User)**:
代表平台上的匹克球玩家个体，拥有唯一的身份标识、头像、昵称、DUPR 自测评分，并关联其签到记录、发帖历史和球局参与记录。
_Avoid_: 账户 (Account), 会员 (Member), 客户端 (Client)

**登录凭证 (Credential)**:
用于证明用户身份的唯一标识凭据，包括验证过的手机号、苹果账号标识（Apple User ID）或微信账号标识（WeChat OpenID/UnionID）。一个用户可以绑定多个不同类型的登录凭证。
_Avoid_: 登录方式 (Login Method), 身份验证 (Auth)

**未激活用户 (Inactive User)**:
通过第三方（如 Apple 或微信）首次授权登录，但尚未完成手机号绑定与验证的用户。此类用户仅拥有系统内容的浏览与查看权限。
_Avoid_: 游客 (Guest), 匿名用户 (Anonymous User)

**激活用户 (Active User)**:
已成功完成手机号绑定与短信验证码验证的用户。激活用户拥有平台的全部使用权限，包括创建球场、签到打卡、留言板发帖及参与/发起球局。
_Avoid_: 真实用户 (Real User), 完整用户 (Full User)

**球场 (Court)**:
代表进行匹克球运动的物理场地。球场具有名称、详细地址、场地数量（片数）、是否室内、是否有照明、网类型及地面类型等物理属性。球场由用户创建，可以被平台验证（Verified）或未验证（Unverified）。
_Avoid_: 场地 (Venue), 球馆 (Facility), 场馆 (Location)

**签到 (Check-In)**:
激活用户在特定球场上申报自己未来计划活动时间段的行为（包含开始时间和结束时间）。签到不产生资金交易，仅作为玩家在该球场上活动的意向展示，用于促进社交匹配。
_Avoid_: 预约 (Reservation), 订场 (Booking)

**球局 (Play Session)**:
由发起人在特定球场上创建的单场拼场活动。球局规定了明确的开赛时间、最大人数、所需的 DUPR 评分技术区间。玩家可以直接加入或退出。
_Avoid_: 活动 (Activity), 拼场 (Matchmaking Session), 比赛 (Match)

**发起人 (Host)**:
创建球局的激活用户。发起人负责球局的基本管理，在面临突发变更时有权取消球局或在特殊情况下调剂玩家。若发起人退出球局，其管理权限会移交给另一名球局成员。
_Avoid_: 组织者 (Organizer), 创建者 (Creator)


