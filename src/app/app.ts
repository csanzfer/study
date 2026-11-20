import { Component } from '@angular/core';
import { AppShell } from './shared/components/app-shell/app-shell';

@Component({
  selector: 'app-root',
  imports: [AppShell],
  styleUrl: './app.scss',
  templateUrl: './app.html',
})
export class App { }
