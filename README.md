# UTOPIA — 가상 SNS

Firebase(Auth · Firestore) + Supabase(Storage)로 만든 정적 웹 SNS입니다. 빌드 과정이 없으니 아무 정적 호스팅(Firebase Hosting, GitHub Pages, Live Server 등)에 그대로 올리면 됩니다.
> ES 모듈을 쓰기 때문에 `file://`로 열면 동작하지 않아요. VS Code **Live Server** 같은 로컬 서버로 열어주세요.

## 파일 구성

| 파일 | 역할 |
|---|---|
| `index.html` | 이메일 로그인 → `main.html` |
| `main.html` | 타임라인, 글쓰기, 댓글·답글, 좋아요, 쪽지함 |
| `profile.html` | 프로필 사진 변경, 닉네임/아이디, 엔트리 스프라이트 (`?uid=` 로 다른 사람 프로필) |
| `shop.html` | 상점 (메뉴에 없음, 주소로만 접근) |
| `css/style.css` | 공통 (토큰·레이아웃·버튼·다이얼로그) / `login` `main` `profile` `shop` .css 페이지별 |
| `js/common.js` | 인증 가드, 사용자 캐시, SVG 아이콘, 토스트, 받는 사람 검색 |
| `js/pokemon.js` | 한국어 이름 → PokeAPI 스프라이트 |
| `firestore.rules` | **보안 규칙 (반드시 적용)** |
| `firestore.indexes.json` | 쪽지함 쿼리용 복합 색인 |
| `supabase-storage.sql` | 아바타 버킷 + 정책 |

## 설정 순서

### 1. Firebase
1. **Authentication → 로그인 방법**에서 *이메일/비밀번호*를 켭니다.
2. 사용자는 **Authentication → 사용자 추가**로 직접 만듭니다 (회원가입 기능 없음).
3. **Firestore → users/{그 사용자의 UID}** 문서를 만듭니다:
   ```
   nickname: "소넷"          (string)
   id: "sonnet_23"           (string, @아이디)
   profileImage: ""          (string, 비워두면 기본 이미지)
   peace: 100                (number)
   entry: [ {name, cardName?, type[], hp, atk, def, spd, moves[{name, pp}], spriteId?} ... ]  최대 6
   ```
   - `spriteId`(선택): 이름으로 스프라이트를 못 찾을 때 전국도감/PokeAPI 번호를 직접 지정.
4. **Firestore → 규칙**에 `firestore.rules` 내용을 붙여넣고 게시합니다.
5. **색인**: `firestore.indexes.json`의 `messages (to ↑, createdAt ↓)` 색인을 만들어 주세요.
   (안 만들어도 쪽지함을 처음 열 때 F12 콘솔에 색인 생성 링크가 뜹니다.)
   CLI를 쓴다면 `firebase deploy --only firestore`.

### 2. Supabase
1. **Authentication → Sign In / Providers → Third-Party Auth → Firebase**를 추가하고 프로젝트 ID `atlas-f52d2`를 입력합니다.
   `js/supabase.js`가 Firebase ID 토큰을 그대로 Supabase에 넘기므로, 각 사용자는 **자기 폴더(`avatars/{uid}/`)에만** 업로드할 수 있습니다.
2. **SQL Editor**에서 `supabase-storage.sql`을 실행합니다 (`avatars` 공개 버킷 + 정책 생성).

## 데이터 구조

```
users/{uid}                      nickname, id, profileImage, peace, entry, lastRecv
users/{uid}/private/inventory    anon, shard, flower, lastTxn       ← 본인만 읽기
posts/{pid}                      uid, nickname, handle, text, createdAt, likes[uid], commentCount
posts/{pid}/comments/{cid}       uid, nickname, handle, text, createdAt, parentId, replyToUid, replyToHandle
messages/{mid}                   type(anon|flower|peace), to, from?, text?, amount?, fee?, createdAt, read
anonLogs/{mid}                   from, to, text, createdAt          ← 클라이언트 읽기 불가
```

### 익명 쪽지가 진짜 익명인 이유
- 받는 사람이 읽는 `messages` 문서에는 **보낸 사람 필드가 아예 없습니다.**
- 실제 발신자는 `anonLogs/{같은 ID}`에만 저장되고, 규칙이 `read: false`라 **F12로 직접 쿼리해도 읽을 수 없습니다.**
- 아이템 수량·`lastTxn`도 비공개 하위 문서에 있어서, 누가 쪽지를 썼는지 다른 문서로 추측할 수 없습니다.
- 관리자는 **Firebase 콘솔 → anonLogs**에서 누가 누구에게 보냈는지 확인할 수 있습니다.

### 거래 검증 (규칙에서 처리)
- 구매: 같은 배치에서 PEACE가 **정확히 가격만큼** 줄어야 아이템 +1이 허용됩니다.
- 사용: 아이템 −1과 쪽지 생성이 반드시 함께 일어나야 합니다.
- 공명 파편: 수수료 `ceil(송금액 × 10%)`를 **별도로** 내서 보낸 사람은 `송금액 + 수수료`만큼 줄고, 받는 사람은 송금액만큼 늘어납니다. 받는 사람의 PEACE는 이 경우에만 다른 사람이 바꿀 수 있습니다.
- 자기 PEACE를 늘리는 쓰기는 모두 거부됩니다.

## 비용 절감 포인트
- **사용자 문서 캐시**: 프로필/닉네임을 localStorage에 10분 캐시하고, 여러 명은 `in` 쿼리(30명씩) 한 번으로 읽습니다.
- **좋아요 = 배열 필드**: 하위 컬렉션 없이 게시글 문서 1개에 저장해서, 타임라인에서 "내가 눌렀는지" 확인할 때 추가 읽기가 없습니다.
- **타임라인은 15개씩 페이지 단위** `getDocs`(실시간 리스너 아님), 댓글은 글을 열 때만 읽고 2분 캐시합니다.
- **실시간 리스너는 안 읽은 쪽지 배지 하나뿐**이고, 안 읽은 쪽지만 구독합니다.
- **아바타는 400px WebP로 줄여서** 업로드하고 공개 URL(CDN)로 읽습니다. 표시할 때 Supabase 요청이 없습니다.
- **스프라이트**: PokeAPI 데이터로 만든 이름표를 30일 캐시합니다. Firebase/Supabase 비용은 0입니다.
