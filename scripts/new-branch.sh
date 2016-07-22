VERSION=$(npm version minor)
BRANCH=$(echo $VERSION | (IFS=".$IFS"; read a b c && echo $a.$b-stable))
echo $BRANCH
#git checkout -b $BRANCH
#git push origin master --tags
#git push origin $BRANCH --tags
