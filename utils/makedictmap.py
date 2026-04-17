import check_tree as ct
from operator import itemgetter
from time import time

alphabet=list('abcdefghijklmnopqrstuvwxyz')
LW = (open("expanded_words.txt").readlines())
L=LW
for i in range(len(LW)):
    L[i]=LW[i].strip('\n')
sortedDict=sorted(L, key=len)

with open("./wordmap2.txt","w") as f:

    graph_dict = {}
    dictn = []
    dictn_idx = -1
    for i in range(len(sortedDict)):
        #f2.write("#"+str(i+1)+"\n"+j[5:]+"\n")
        start_time = time()
        this_len = len(sortedDict[i])
        len_diff = 1
        if i > 0:
            len_diff = this_len - len(sortedDict[i-1])
        if len_diff > 0:
            dictn = []
            dictn_idx = -1
            for j,item in enumerate(sortedDict):
                if (len(item)>=this_len-1 and len(item)<=this_len+1):
                    if dictn_idx < 0:
                        dictn_idx = j
                    dictn.append(item)
            #dictn = [item for item in sortedDict if (len(item)>=this_len-1 and len(item)<=this_len+1)]
        dict_gen_time = time()
        ct.calc_one_word(sortedDict[i],i,graph_dict,dictn,dictn_idx)
        one_stage_time = time()
        
        if i%100==0 and i > 0:
            print(round(i/len(sortedDict),3)*100,'%')
            #print(f"dict gen {dict_gen_time-start_time}")
            #print(f"one stage {one_stage_time-dict_gen_time}")

    for word in sortedDict:
        f.write(f"{word}:{graph_dict[word]}\n")
    
    
