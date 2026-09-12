"""Rebuild JobPilot vector assets, PNG exports and Russian brand book."""
from pathlib import Path
from io import BytesIO
from xml.sax.saxutils import escape
import json, math
import fitz
from reportlab.pdfgen import canvas
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from fontTools.ttLib import TTFont as FTFont
from fontTools.pens.svgPathPen import SVGPathPen

ROOT = Path(__file__).resolve().parents[1]
RED='#E52535'; INK='#202124'; WHITE='#FFFFFF'; PAPER='#F6F5F3'; MUTED='#68696D'; LINE='#DEDDDA'; PALE='#FCE9EB'
FONTS={}
for name, file in [('Regular','DejaVuSans.ttf'),('Bold','DejaVuSans-Bold.ttf')]:
    path=ROOT/'fonts'/file
    pdfmetrics.registerFont(TTFont(name,str(path)))
    FONTS[name]=FTFont(path)

def width(text,size=16,bold=False):
    return pdfmetrics.stringWidth(text,'Bold' if bold else 'Regular',size)

class Surface:
    def __init__(self,w,h,pdf=None):
        self.w,self.h=w,h; self.buf=BytesIO(); self.pdf=pdf or canvas.Canvas(self.buf,pagesize=(w,h),pageCompression=1)
        self.svg=[]
    def rect(self,x,y,w,h,fill,r=0,stroke=None,sw=1):
        c=self.pdf; c.setFillColor(fill); c.setStrokeColor(stroke or fill); c.setLineWidth(sw)
        c.roundRect(x,self.h-y-h,w,h,r,fill=1,stroke=int(bool(stroke)))
        self.svg.append(f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="{r}" fill="{fill}"'+(f' stroke="{stroke}" stroke-width="{sw}"' if stroke else '')+'/>')
    def circle(self,x,y,r,fill=None,stroke=None,sw=1):
        c=self.pdf;c.setFillColor(fill or WHITE);c.setStrokeColor(stroke or fill or WHITE);c.setLineWidth(sw)
        c.circle(x,self.h-y,r,fill=int(bool(fill)),stroke=int(bool(stroke)))
        self.svg.append(f'<circle cx="{x}" cy="{y}" r="{r}" fill="{fill or "none"}" stroke="{stroke or "none"}" stroke-width="{sw}"/>')
    def line(self,x1,y1,x2,y2,color=LINE,sw=1):
        c=self.pdf;c.setStrokeColor(color);c.setLineWidth(sw);c.setLineCap(1);c.line(x1,self.h-y1,x2,self.h-y2)
        self.svg.append(f'<path d="M{x1} {y1} L{x2} {y2}" stroke="{color}" stroke-width="{sw}" stroke-linecap="round"/>')
    def text(self,text,x,y,size=16,color=INK,bold=False):
        name='Bold' if bold else 'Regular';c=self.pdf;c.setFillColor(color);c.setFont(name,size);c.drawString(x,self.h-y,text)
        ft=FONTS[name];glyphs=ft.getGlyphSet();cmap=ft.getBestCmap();scale=size/ft['head'].unitsPerEm;cursor=x
        paths=[]
        for ch in text:
            gn=cmap[ord(ch)];pen=SVGPathPen(glyphs);glyphs[gn].draw(pen)
            paths.append(f'<path transform="translate({cursor:.4f} {y}) scale({scale:.7f} {-scale:.7f})" d="{pen.getCommands()}"/>')
            cursor+=ft['hmtx'][gn][0]*scale
        self.svg.append(f'<g fill="{color}" aria-label="{escape(text)}">'+''.join(paths)+'</g>')
    def para(self,text,x,y,maxw,size=16,color=INK,leading=None,bold=False):
        leading=leading or size*1.55
        for paragraph in text.split('\n'):
            line=''
            for word in paragraph.split():
                candidate=(line+' '+word).strip()
                if width(candidate,size,bold)>maxw and line:
                    self.text(line,x,y,size,color,bold);y+=leading;line=word
                else:line=candidate
            if line:self.text(line,x,y,size,color,bold);y+=leading
        return y
    def save_asset(self,name,title,scale=1):
        svg=f'<svg xmlns="http://www.w3.org/2000/svg" width="{self.w}" height="{self.h}" viewBox="0 0 {self.w} {self.h}" role="img"><title>{escape(title)}</title>'+''.join(self.svg)+'</svg>'
        (ROOT/'assets/source'/f'{name}.svg').write_text(svg)
        self.pdf.save();doc=fitz.open(stream=self.buf.getvalue(),filetype='pdf');doc[0].get_pixmap(matrix=fitz.Matrix(scale,scale),alpha=True).save(ROOT/'assets'/f'{name}.png')

def radar(s,x,y,size=64,bg=RED,fg=WHITE,tile=True):
    k=size/64
    if tile:s.rect(x,y,size,size,bg,14*k)
    s.circle(x+32*k,y+32*k,21*k,stroke=fg,sw=2.6*k)
    if size>=24:s.circle(x+32*k,y+32*k,11*k,stroke=fg,sw=2.1*k)
    s.line(x+32*k,y+32*k,x+47*k,y+17*k,fg,3*k)
    s.circle(x+32*k,y+32*k,2.4*k,fill=fg)
    if size>=24:
        s.circle(x+19*k,y+42*k,4.3*k,fill=bg)
        s.circle(x+19*k,y+42*k,2.7*k,fill=fg)

def logo(s,x,y,size=48,dark=False):
    radar(s,x,y,size)
    s.text('JobPilot',x+size+size*.28,y+size*.73,size*.65,WHITE if dark else INK,True)

for name,dark in [('jobpilot-logo',False),('jobpilot-logo-dark',True)]:
    s=Surface(560,144);s.rect(0,0,560,144,INK if dark else WHITE);logo(s,28,28,88,dark);s.save_asset(name,'JobPilot — логотип',2)
s=Surface(512,512);radar(s,0,0,512);s.save_asset('jobpilot-icon','JobPilot — белый радар на красном фоне')
for px in [16,32,48]:
    s=Surface(px,px);radar(s,0,0,px);s.save_asset(f'favicon-{px}','JobPilot — иконка')
for name,bg,fg in [('jobpilot-mark-black',WHITE,INK),('jobpilot-mark-white',INK,WHITE)]:
    s=Surface(128,128);radar(s,0,0,128,bg,fg);s.save_asset(name,'JobPilot — монохромный знак')

s=Surface(1600,640);s.rect(0,0,1600,640,RED)
radar(s,72,58,66);s.text('JobPilot',157,107,42,WHITE,True)
s.text('Работа, которая',72,275,76,WHITE,True);s.text('вам подходит.',72,365,76,WHITE,True)
s.text('От выбора вакансии до оффера.',76,431,28,WHITE)
s.line(76,524,976,524,'#F07882',1)
s.text('ПОИСК',76,571,16,WHITE,True);s.text('РЕЗЮМЕ',260,571,16,WHITE,True);s.text('ОТКЛИКИ',468,571,16,WHITE,True);s.text('ИНТЕРВЬЮ',680,571,16,WHITE,True)
radar(s,1070,110,450,tile=False)
s.save_asset('jobpilot-banner','JobPilot. Работа, которая вам подходит. От выбора вакансии до оффера.')

W,H=1120,720
book=canvas.Canvas(str(ROOT/'brand/JobPilot_Brandbook.pdf'),pagesize=(W,H),pageCompression=1)
book.setTitle('JobPilot — брендбук');book.setAuthor('JobPilot');book.setSubject('Фирменный стиль и правила применения. Версия 1.0')
page_no=0

def page(section,title,sub=None,dark=False):
    global page_no
    page_no+=1;s=Surface(W,H,book);s.rect(0,0,W,H,INK if dark else PAPER)
    s.text('JobPilot',56,44,16,WHITE if dark else INK,True);s.text(section.upper(),810,44,10,'#A4A4A4' if dark else MUTED)
    s.line(56,65,1064,65,'#454548' if dark else LINE)
    s.text(title,56,133,38,WHITE if dark else INK,True)
    if sub:s.para(sub,56,172,970,16,'#C5C5C7' if dark else MUTED)
    s.line(56,667,1064,667,'#454548' if dark else LINE)
    s.text('ФИРМЕННЫЙ СТИЛЬ  /  1.0  /  СЕНТЯБРЬ 2026',56,692,9,'#A4A4A4' if dark else MUTED)
    s.text(f'{page_no:02d}',1038,692,11,WHITE if dark else INK)
    return s

def end():book.showPage()
def card(s,x,y,w,title,body,n=None):
    s.rect(x,y,w,190,WHITE,16)
    if n:s.text(n,x+24,y+35,12,RED,True)
    s.text(title,x+24,y+72,21,INK,True);s.para(body,x+24,y+107,w-48,14,MUTED)

s=page('Брендбук','Работа, которая вам подходит.',dark=True)
s.text('JobPilot',54,321,88,WHITE,True)
s.para('Персональный сервис поиска работы\nдля российского рынка.',60,398,640,24,WHITE)
radar(s,801,258,224)
s.text('ИДЕНТИЧНОСТЬ  /  ГРАФИКА  /  КОММУНИКАЦИЯ',60,589,12,'#B8B8BB')
end()

s=page('01 / Основа','Меньше рутины. Больше ясности.','JobPilot помогает кандидату последовательно пройти путь от поиска до предложения о работе.')
card(s,56,231,320,'Проблема','Вакансии, версии резюме и переписки разбросаны. Кандидату сложно выбирать и помнить следующий шаг.','01')
card(s,400,231,320,'Роль продукта','Собрать поиск, подготовку документов и историю откликов в одном понятном рабочем пространстве.','02')
card(s,744,231,320,'Обещание','Помочь найти подходящие позиции и подготовить осмысленный отклик. Решение остаётся за человеком.','03')
s.text('ХАРАКТЕР',56,489,12,RED,True)
s.text('Собранный. Прямой. Внимательный.',56,542,30,INK,True)
s.para('Бренд не обещает трудоустройство и не выдаёт оценку соответствия за вероятность оффера.',56,589,945,16,MUTED)
end()

s=page('02 / Аудитория','На стороне кандидата.','Стартовая аудитория: специалисты, которые самостоятельно ищут следующую работу в России.')
rows=[('Выбрать','Отделить подходящие вакансии от нерелевантных по опыту, доходу и формату.'),('Подготовиться','Показать реальный опыт под требования позиции, сохранив факты.'),('Не потерять','Видеть этап каждого отклика, договорённости и ближайшее действие.')]
for i,(t,b) in enumerate(rows):
    y=242+i*108;s.text('0'+str(i+1),56,y,15,RED,True);s.text(t,115,y,25,INK,True);s.para(b,420,y,610,16,MUTED);s.line(115,y+60,1064,y+60)
s.para('Российский контекст: зарплата в ₽ с пометкой «на руки» или «до вычета», город, удалённо / гибрид / офис, понятные названия должностей и русский интерфейс.',56,597,990,15,MUTED)
end()

s=page('03 / Знак','Радар. В фокусе - подходящая работа.','Самостоятельный символ без букв. Красное поле и белая геометрия образуют основной знак.')
radar(s,78,242,312)
s.text('Круги',480,275,24,INK,True);s.para('Область поиска и последовательное уточнение выбора.',480,310,530,16,MUTED)
s.text('Луч',480,381,24,INK,True);s.para('Направление внимания: от общего списка к конкретной позиции.',480,416,530,16,MUTED)
s.text('Точка',480,487,24,INK,True);s.para('Найденная возможность. Не обещание результата и не показатель присутствия онлайн.',480,522,530,16,MUTED)
end()

s=page('04 / Логотип','Один знак. Два способа применения.','Иконка используется отдельно. В подписи продукта к ней добавляется название JobPilot.')
s.rect(56,227,1008,155,WHITE,18);logo(s,88,260,88)
s.rect(56,402,1008,155,INK,18);logo(s,88,435,88,True)
s.para('Название пишется только JobPilot: латиницей, с заглавными J и P. В интерфейсе и коммуникации основной язык - русский. Слоган не является частью логотипа.',56,602,975,15,MUTED)
end()

s=page('05 / Геометрия','Форма, отступы и минимальный размер.','Исходная сетка знака: 64 × 64 единицы. Не перерисовывайте знак вручную.')
s.rect(65,235,300,300,PALE,0)
radar(s,115,285,200)
s.text('Охранное поле: 1/4 стороны',65,584,15,INK,True)
s.para('С каждой стороны знака и всего логотипа.\nНа схеме: 50 px вокруг знака 200 px.',65,615,375,12,MUTED)
s.para('Контейнер: скругление 14/64. Центр: 32;32. Радиусы колец: 21 и 11. Толщина внешнего кольца: 2,6. Луч направлен под 45° вверх вправо.',460,257,555,16)
for x,sz in [(465,16),(563,32),(677,48),(807,64)]:
    radar(s,x,393,sz);s.text(f'{sz} px',x,484,13,MUTED)
s.para('16 px: отдельная упрощённая версия без внутреннего кольца и боковой точки. Основной знак - от 24 px. Логотип с названием - от 160 px по ширине.',460,543,552,15,MUTED)
end()

s=page('06 / Варианты','Контраст и узнаваемость.','Основная версия всегда сохраняет белый радар на красном фоне.')
for x,bg,fg,label in [(56,RED,WHITE,'Основной'),(400,INK,WHITE,'Монохром / тёмный'),(744,WHITE,INK,'Монохром / светлый')]:
    s.rect(x,230,320,280,WHITE,16);radar(s,x+82,257,156,bg,fg);s.text(label,x+24,474,17,INK,True)
s.para('Монохромные версии нужны для однокрасочной печати и ограниченных носителей. На фотографии используйте сплошную подложку. Не применяйте тени, градиенты и прозрачность к основному знаку.',56,565,980,17,MUTED)
end()

s=page('07 / Палитра','Красный - узнаваемость. Воздух - баланс.','В маркетинге красный может занимать весь фон. В продукте он выделяет основные действия.')
colors=[('Signal',RED,'229 / 37 / 53'),('Ink',INK,'32 / 33 / 36'),('Paper',PAPER,'246 / 245 / 243'),('White',WHITE,'255 / 255 / 255')]
for i,(name,hexv,rgb) in enumerate(colors):
    x=56+i*258;s.rect(x,238,234,205,hexv,14,LINE if i>1 else None);s.text(name,x,483,23,INK,True);s.text(hexv,x,517,17);s.text('RGB '+rgb,x,547,12,MUTED)
s.para('Дополнительные: вторичный текст #68696D, линии #DEDDDA, мягкий красный фон #FCE9EB. Рабочее пространство: 80% светлых поверхностей, 15% нейтральных, до 5% красных акцентов.',56,592,990,15,MUTED)
end()

s=page('08 / Типографика','Ясный текст. Спокойная иерархия.','DejaVu Sans: открытый шрифт с кириллицей. Regular и Bold входят в репозиторий вместе с лицензией.')
s.text('Новая работа',56,285,64,INK,True);s.text('начинается с выбора.',56,348,44)
s.text('Аа Бб Вв Гг Дд Ее Ёё Жж Зз',56,418,25)
s.text('0123456789  ₽  %  +  /  @',56,461,25)
s.line(56,497,1064,497)
s.para('Заголовок: 32–48 px / Bold\nПодзаголовок: 20–24 px / Bold\nОсновной текст: 16 px / Regular\nПодписи: 12–14 px / Regular',56,539,460,16)
s.para('Межстрочный интервал: 140–160%. Не используйте капс в длинном тексте. В веб-интерфейсе допустим системный sans-serif. В SVG буквы переведены в контуры для стабильного отображения.',575,539,489,15,MUTED)
end()

s=page('09 / Система','Интерфейс, который помогает выбирать.','Пример направления дизайна. Макет иллюстративный; это не скриншот работающего сервиса.')
s.rect(56,223,650,382,WHITE,16);logo(s,80,243,32)
s.text('Подходит по основным требованиям',80,322,21,INK,True)
s.text('Продуктовый аналитик',80,365,25,INK,True)
s.text('Москва · Гибрид · 180 000–230 000 ₽ на руки',80,401,15,MUTED)
s.rect(80,425,174,30,PALE,8);s.text('SQL подтверждён',94,445,12,INK)
s.rect(264,425,185,30,PAPER,8);s.text('Python: уточнить опыт',276,445,12,INK)
s.text('Следующий шаг: проверьте черновик письма.',80,495,15)
s.rect(80,522,212,46,RED,10);s.text('Проверить отклик',99,551,16,WHITE,True)
s.para('Сетка кратна 8 px.\nОтступы: 8 / 16 / 24 / 32.\nРадиус карточек: 16 px.\nРадиус кнопок: 10 px.',758,256,292,16)
s.para('Не используйте цвет как единственный сигнал. Статус всегда подписан. Ошибка содержит причину и действие. Видимый фокус обязателен.',758,419,292,16,MUTED)
end()

s=page('10 / Голос','Говорим по делу. Уважаем решение.','Короткие фразы, конкретные действия, честное объяснение ограничений.')
examples=[('Вместо обещания','«Гарантируем оффер мечты»','«Подберите вакансии под свой опыт». '),('Вместо давления','«Откликайтесь, пока не поздно!»','«Проверьте письмо перед отправкой». '),('Вместо магии','«Идеальное совпадение: 98%»','«Опыт SQL подходит. Python нужно уточнить». ')]
for i,(label,bad,good) in enumerate(examples):
    y=241+i*122;s.text(label,56,y,13,RED,True);s.text(bad,56,y+35,18,MUTED);s.text(good,56,y+71,21,INK,True)
s.para('Обращение на «вы», без канцелярита. Не придумываем опыт, цифры клиентов и партнёрства. Оценку соответствия объясняем требованиями, а не вероятностью трудоустройства.',56,619,990,14,MUTED)
end()

s=page('11 / Носители','Узнаваемо в любом масштабе.','Одна система для репозитория, аватара продукта и коммуникаций.')
s.rect(56,228,680,292,RED,16);logo(s,82,251,38,True)
s.text('Работа, которая',82,369,36,WHITE,True);s.text('вам подходит.',82,414,36,WHITE,True);s.text('От выбора вакансии до оффера.',84,477,16,WHITE)
radar(s,556,279,140,tile=False)
radar(s,815,233,160);s.text('Аватар / 512 × 512',791,431,15,INK,True)
s.text('README / 1600 × 640',56,556,15,INK,True)
s.para('Для GitHub используйте готовый PNG-баннер. SVG-исходники не зависят от внешних шрифтов или ссылок. Иконку размещайте без дополнительной подписи внутри красного поля.',56,603,990,15,MUTED)
end()

s=page('12 / Ограничения','Сохраняйте простую форму.','Любая адаптация должна оставлять знак узнаваемым и читаемым.')
items=[('Не растягивать','Пропорции контейнера и радара фиксированы.'),('Не добавлять буквы','Внутри иконки нет J, JP, надписей и слоганов.'),('Не менять направление','Луч всегда направлен вверх вправо.'),('Не усложнять','Без объёма, бликов, градиентов и декоративных колец.'),('Не смешивать бренды','Не добавлять hh и обозначения других площадок.'),('Не терять контраст','Белый знак ставится на красное или тёмное поле.')]
for i,(t,b) in enumerate(items):
    col=i%2;row=i//2;x=56+col*520;y=240+row*125
    s.text('0'+str(i+1),x,y,12,RED,True);s.text(t,x+38,y,22,INK,True);s.para(b,x+38,y+35,445,15,MUTED)
end()

s=page('13 / Передача','Всё необходимое для старта.','Исходники, экспорты и правила находятся в одном репозитории.')
files=[('assets/source/','SVG: логотип, иконка, баннер, монохром и favicon.'),('assets/','PNG-экспорты для GitHub и внешних носителей.'),('brand/tokens.json','Цвета, типографика, отступы и скругления.'),('scripts/build_brand.py','Воспроизводимая сборка графики и этого PDF.'),('fonts/','Шрифты DejaVu Sans и условия их использования.')]
for i,(path,desc) in enumerate(files):
    y=240+i*65;s.text(path,56,y,17,INK,True);s.text(desc,394,y,14,MUTED);s.line(56,y+24,1064,y+24)
s.para('Перед выпуском: проверить охранное поле, читабельность на целевом размере, фон и актуальность текста. Для печати согласовать цветопробу с типографией; исходная палитра задана в sRGB.',56,599,990,15,MUTED)
end();book.save()

tokens={'version':'1.0','colors':{'signal':RED,'ink':INK,'paper':PAPER,'white':WHITE,'textSecondary':MUTED,'border':LINE,'signalSoft':PALE},'typography':{'family':'DejaVu Sans','fallback':'system-ui, sans-serif','weights':[400,700],'bodySize':16,'bodyLineHeight':1.5},'spacing':[4,8,16,24,32,48,64],'radius':{'button':10,'card':16,'iconRatio':14/64},'logo':{'clearSpaceRatio':0.25,'minIconPx':24,'smallIconPx':16,'minLockupWidthPx':160}}
(ROOT/'brand/tokens.json').write_text(json.dumps(tokens,ensure_ascii=False,indent=2)+'\n')
print('Built 14-page brandbook and vector/PNG asset pairs.')
