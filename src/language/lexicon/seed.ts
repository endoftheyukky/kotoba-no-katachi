/**
 * seed-lexicon v0 — a prototype of the finite semantic vocabulary this work
 * defines for itself: single characters, written by hand by its author, with
 * no data taken from another dictionary. Every line is a common, literal
 * relation between two everyday characters (rain is made of water; a bud
 * becomes a flower; the moon is there with the night). Nothing figurative,
 * nothing emotional, nothing cultural beyond the literal.
 *
 * It is not a general resource for Japanese meaning. It covers whole fields
 * (sky, light, water, land, plants, animals, the body, people, dwellings,
 * time, things, sound, a few actions), but it was written with the
 * development titles in view, and some of its entries were written for
 * characters those titles use; the holdout titles were not consulted, though
 * they had been seen. Its order of nearness (inside, beside, before or after)
 * is this work's rule, not a claim about meaning in general.
 * It is used only in review; the published page never takes from it.
 *
 * Format, one statement per line:
 *   @id 名前: 字字字…            a category and its members
 *   頭 relation:字字 relation:字   relations from a head (see lexicon/index.ts)
 * `#` begins a comment.
 */
export const SEED_LEXICON_VERSION = 'seed-lexicon v0'

export const SEED_LEXICON = `
# ---- categories ----------------------------------------------------------
@sky 天象: 空天雲雨雪風雷霧虹霜露嵐
@light 光: 日月星光影闇陽灯火炎煙灰
@water 水: 水海川湖池沼泉滝波潮滴泡氷雫湯
@land 土地: 山丘谷野原岩石砂土岸島坂道地畑田穴泥粒
@plant 植物: 木林森花草葉根枝幹種芽実茎竹苔蕾稲米節
@animal 生き物: 鳥魚犬猫虫馬牛羊蝶蜂羽卵巣鱗角毛尾
@body 身体: 体手足指目耳口鼻歯顔髪骨血肌息心胸涙
@people 人: 人子母父兄姉弟妹友王民客
@dwelling 住まい: 家屋門戸窓壁庭城塔橋町村都国
@time 時: 朝昼夕夜春夏秋冬年時
@thing もの: 本字紙筆墨糸布針鏡傘舟船車輪鐘箱皿冠片
@sound 音: 音声歌
@act 動き: 見聞言話書読咲触走歩飛泳眠夢探泣笑食待帰

# ---- relations -----------------------------------------------------------
# sky
空 with:雲鳥星 opposite:地
天 with:空星 opposite:地
雲 made-of:水 with:空風
雨 made-of:水 unit:滴 source:雲 with:傘
雪 made-of:氷 unit:片 with:冬
風 with:空雲
雷 source:雲 with:光音
霧 made-of:水 unit:粒
虹 source:雨光 with:空
霜 made-of:氷 with:冬朝
露 made-of:水 unit:滴 with:朝草葉
嵐 made-of:風雨
# light
日 with:空光
陽 with:空光
月 with:夜星
星 with:夜空
光 source:日火 opposite:影闇
影 source:光
闇 with:夜 opposite:光
灯 source:火 with:夜光
火 unit:炎 yields:煙灰 with:光
# water
水 unit:滴泡 becomes:氷 with:魚
海 made-of:水 part:波潮 with:岸島魚
川 made-of:水 part:岸 source:山 with:魚橋石
湖 made-of:水 part:岸
池 made-of:水 with:魚
沼 made-of:水泥
泉 made-of:水 source:地
滝 made-of:水 with:岩
波 made-of:水 unit:泡 source:風 with:岸
潮 source:月
滴 made-of:水
泡 made-of:水
氷 made-of:水 with:冬
雫 made-of:水
湯 made-of:水
# land
山 part:岩石谷 with:木雲
丘 made-of:土 with:草
谷 with:川山
野 with:草花風
原 with:草風
岩 part:石
石 becomes:砂 source:岩
砂 unit:粒 source:石
土 part:砂石 with:根種
岸 with:波石
島 with:海波
坂 with:道
道 with:石
地 part:土石 opposite:天
田 with:稲水
畑 made-of:土 with:種
穴 with:土
# plants
木 part:枝葉根幹
林 made-of:木 with:鳥
森 made-of:木 part:葉 with:鳥苔
花 part:葉茎 becomes:実 with:蝶蜂
草 part:葉根 with:露
葉 source:枝 with:露風
根 with:土
枝 part:葉 source:幹
幹 part:枝
種 becomes:芽 with:土
芽 becomes:葉花木
蕾 becomes:花
実 part:種
茎 part:葉
竹 part:節葉
苔 with:石
稲 becomes:米
# animals
鳥 part:羽 yields:卵 with:空巣枝
魚 part:鱗 with:水
犬 part:毛尾
猫 part:毛尾
虫 with:草葉
馬 part:毛尾
牛 part:角
羊 part:毛
蝶 part:羽 with:花
蜂 with:花巣
巣 with:枝
# the body
人 part:手足顔心
体 part:手足骨血
手 part:指
足 part:指
顔 part:目口鼻耳
口 part:歯 yields:声息
声 with:耳
心 with:胸
# people
子 source:母父
王 with:冠城民
国 part:民土城都
民 with:国
# dwellings
城 part:門壁塔
家 part:窓戸壁庭
門 part:戸
窓 with:光風
町 part:家道
村 part:家田
都 part:町
# time
朝 becomes:昼 with:日露
昼 becomes:夕 with:日
夕 becomes:夜 with:日影
夜 becomes:朝 with:月星闇
春 becomes:夏 with:花芽
夏 becomes:秋 with:日
秋 becomes:冬 with:葉月
冬 becomes:春 with:雪氷
# things
本 made-of:紙 part:字
字 with:紙筆墨
筆 yields:字 with:墨
糸 becomes:布
舟 with:水波
船 with:海波
車 part:輪 with:道
鐘 yields:音
傘 with:雨
鏡 with:光
# sound
音 with:耳
歌 organ:口 yields:声
# actions
見 organ:目 with:光
聞 organ:耳 with:音声
言 organ:口 yields:声
話 organ:口 yields:声
書 yields:字 with:筆紙
読 organ:目 with:字本
咲 with:花
触 organ:手指
走 organ:足 with:道
歩 organ:足 with:道
飛 organ:羽 with:空
泳 with:水魚
眠 with:夜夢
夢 with:眠
探 organ:目手
泣 organ:目 yields:涙
笑 organ:口顔
食 organ:口歯
帰 with:家道
`
