import showdown from "showdown";
import {
  GithubIssue,
  getOpenIssues,
  GithubIssueLabel,
  getComments,
  GithubComment,
} from "./GithubService";
import yaml from "js-yaml";
import { useState, useEffect } from "react";

export interface RecipeComment {
  body: string;
  user: string;
}

export interface RecipeIngredient {
  quantity?: number;
  unit?: string;
  name: string;
}

export interface RecipeTag {
  name: string;
  color: string;
}

export interface Recipe {
  id: number;
  name: string;
  image?: string;
  tags: RecipeTag[];
  duration?: string;
  servings: number;
  ingredients: RecipeIngredient[];
  detailsHtml: string;
  detailsMarkdown: string;
  issueLink: string;
  comments: RecipeComment[];
}

export interface RecipeMetadata {
  image?: string;
  durée?: string;
  personnes?: number;
  ingrédients?: string[];
}

function strToIngredient(ingredient: string): RecipeIngredient | undefined {
  const regex = /^([0-9.]+)([a-zA-Zèàé]*) (.*)$/gi;

  if (regex.test(ingredient)) {
    // reset regex
    regex.lastIndex = 0;
    const args = regex.exec(ingredient);
    if (!args) {
      return undefined;
    }
    return {
      quantity: Number.parseFloat(args[1]),
      unit: args[2] || undefined,
      name: args[3],
    };
  } else {
    return { name: ingredient };
  }
}

function labelToTag(label: GithubIssueLabel): RecipeTag {
  return { name: label.name, color: `#${label.color}` };
}

function issueToRecipe(issue: GithubIssue, comments: GithubComment[]): Recipe {
  const converter = new showdown.Converter({ metadata: true });
  const detailsHtml = converter.makeHtml(issue.body);
  const rawMetadata = converter.getMetadata(true) as string;
  const metadata = yaml.safeLoad(rawMetadata) as RecipeMetadata;
  return {
    id: issue.id,
    name: issue.title,
    image: metadata.image,
    tags: issue.labels.map(labelToTag),
    duration: metadata.durée,
    servings: metadata.personnes || 1,
    ingredients: (metadata.ingrédients || [])
      .map(strToIngredient)
      .filter((x) => x) as RecipeIngredient[],
    detailsHtml,
    detailsMarkdown: issue.body,
    issueLink: issue.html_url,
    comments: comments
      .filter((c) => c.issueId === issue.number)
      .map((c) => ({ user: c.user.login, body: c.body })),
  };
}

export function useFindAllRecipes(): [Recipe[] | undefined, Error | undefined] {
  const [recipes, setRecipes] = useState<Recipe[]>();
  const [error, setError] = useState<Error>();

  useEffect(() => {
    async function getRecipes() {
      try {
        const [issues, comments] = await Promise.all([
          getOpenIssues(),
          getComments(),
        ]);
        setRecipes(
          issues
            .map((issue) => {
              try {
                return issueToRecipe(issue, comments);
              } catch (e) {
                console.error(e);
                return undefined;
              }
            })
            .filter((x) => x) as Recipe[]
        );
      } catch (e) {
        setError(e);
      }
    }

    getRecipes();
  }, []);

  return [recipes, error];
}
